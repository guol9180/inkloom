use chrono::{DateTime, Utc};
#[cfg(not(test))]
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    ffi::OsStr,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
#[cfg(not(test))]
use std::sync::Mutex;
#[cfg(not(test))]
use tauri::{AppHandle, Emitter, State};
use tempfile::Builder;

#[cfg(windows)]
use windows_sys::Win32::Storage::FileSystem::ReplaceFileW;

type CommandResult<T> = Result<T, CommandError>;
type Revision = u64;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandError {
    code: String,
    message: String,
    current_revision: Option<Revision>,
}

impl CommandError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            current_revision: None,
        }
    }

    fn revision_conflict(expected: Revision, actual: Revision) -> Self {
        Self {
            code: "REVISION_CONFLICT".into(),
            message: format!("Document changed from revision {expected} to {actual}."),
            current_revision: Some(actual),
        }
    }
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for CommandError {}

impl From<io::Error> for CommandError {
    fn from(error: io::Error) -> Self {
        let code = match error.kind() {
            io::ErrorKind::PermissionDenied => "PERMISSION_DENIED",
            io::ErrorKind::NotFound => "DOCUMENT_NOT_FOUND",
            _ => "IO_ERROR",
        };
        Self::new(code, error.to_string())
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceInfo {
    root: String,
    name: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentMeta {
    id: String,
    workspace_id: String,
    path: String,
    title: String,
    tags: Vec<String>,
    revision: Revision,
    content_hash: String,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentSnapshot {
    meta: DocumentMeta,
    markdown: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum WorkspaceNode {
    Folder {
        id: String,
        name: String,
        path: String,
        children: Vec<WorkspaceNode>,
    },
    Document {
        id: String,
        name: String,
        path: String,
        meta: DocumentMeta,
    },
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateDocumentRequest {
    path: String,
    title: String,
    markdown: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteDocumentRequest {
    document_id: String,
    markdown: String,
    base_revision: Revision,
    title: Option<String>,
    tags: Option<Vec<String>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MoveNodeRequest {
    node_id: String,
    target_path: String,
    base_revision: Revision,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteNodeRequest {
    node_id: String,
    base_revision: Revision,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadDocumentRequest {
    document_id: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexedDocument {
    id: String,
    revision: Revision,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceIndex {
    version: u32,
    documents: BTreeMap<String, IndexedDocument>,
}

impl Default for WorkspaceIndex {
    fn default() -> Self {
        Self {
            version: 1,
            documents: BTreeMap::new(),
        }
    }
}

struct WorkspaceSession {
    root: PathBuf,
    index: WorkspaceIndex,
}

impl WorkspaceSession {
    fn open(root: PathBuf) -> CommandResult<Self> {
        let root = root.canonicalize()?;
        if !root.is_dir() {
            return Err(CommandError::new(
                "INVALID_WORKSPACE",
                "The selected workspace is not a directory.",
            ));
        }

        fs::create_dir_all(root.join(".inkloom"))?;
        let mut index = load_index(&root)?;
        sync_index(&root, &mut index)?;
        save_index(&root, &index)?;
        Ok(Self { root, index })
    }

    fn info(&self) -> WorkspaceInfo {
        WorkspaceInfo {
            root: self.root.to_string_lossy().into_owned(),
            name: self
                .root
                .file_name()
                .and_then(OsStr::to_str)
                .unwrap_or("Workspace")
                .to_owned(),
        }
    }
}

#[cfg(not(test))]
#[derive(Default)]
struct AppState {
    session: Mutex<Option<WorkspaceSession>>,
    watcher: Mutex<Option<RecommendedWatcher>>,
}

#[cfg(not(test))]
#[tauri::command]
fn open_workspace(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> CommandResult<WorkspaceInfo> {
    let session = WorkspaceSession::open(PathBuf::from(path))?;
    let info = session.info();
    let watcher = watch_workspace(&session.root, app)?;
    *state
        .session
        .lock()
        .map_err(|_| CommandError::new("STATE_LOCKED", "Workspace state is unavailable."))? =
        Some(session);
    *state
        .watcher
        .lock()
        .map_err(|_| CommandError::new("STATE_LOCKED", "File watcher state is unavailable."))? =
        Some(watcher);
    Ok(info)
}

#[cfg(not(test))]
#[tauri::command]
fn current_workspace(state: State<'_, AppState>) -> CommandResult<Option<WorkspaceInfo>> {
    let mut guard = state
        .session
        .lock()
        .map_err(|_| CommandError::new("STATE_LOCKED", "Workspace state is unavailable."))?;
    Ok(guard.as_mut().map(|session| session.info()))
}

#[cfg(not(test))]
#[tauri::command]
fn list_tree(state: State<'_, AppState>) -> CommandResult<WorkspaceNode> {
    let mut guard = state
        .session
        .lock()
        .map_err(|_| CommandError::new("STATE_LOCKED", "Workspace state is unavailable."))?;
    let session = require_session(&mut guard)?;
    sync_index(&session.root, &mut session.index)?;
    save_index(&session.root, &session.index)?;
    build_tree(&session.root, &session.index)
}

#[cfg(not(test))]
#[tauri::command]
fn read_document(
    state: State<'_, AppState>,
    request: ReadDocumentRequest,
) -> CommandResult<DocumentSnapshot> {
    let mut guard = state
        .session
        .lock()
        .map_err(|_| CommandError::new("STATE_LOCKED", "Workspace state is unavailable."))?;
    let session = require_session(&mut guard)?;
    let path = find_path_by_id(&session.index, &request.document_id)?;
    snapshot_for_path(&session.root, &path, &session.index)
}

#[cfg(not(test))]
#[tauri::command]
fn create_document(
    state: State<'_, AppState>,
    request: CreateDocumentRequest,
) -> CommandResult<DocumentSnapshot> {
    let mut guard = state
        .session
        .lock()
        .map_err(|_| CommandError::new("STATE_LOCKED", "Workspace state is unavailable."))?;
    let session = require_session(&mut guard)?;
    let relative = validate_relative_path(&request.path)?;
    let target = prepare_new_file_path(&session.root, &relative)?;
    let markdown = request
        .markdown
        .unwrap_or_else(|| format!("# {}\n\n", request.title));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|error| {
            if error.kind() == io::ErrorKind::AlreadyExists {
                CommandError::new("DOCUMENT_EXISTS", "A file already exists at this path.")
            } else {
                error.into()
            }
        })?;
    file.write_all(markdown.as_bytes())?;
    file.sync_all()?;

    let path_key = logical_path(&relative);
    let entry = IndexedDocument {
        id: next_document_id(),
        revision: revision_for(&target)?,
        title: Some(request.title),
        tags: vec![],
    };
    session.index.documents.insert(path_key.clone(), entry.clone());
    save_index(&session.root, &session.index)?;
    snapshot_for_path(
        &session.root,
        &session.index
            .documents
            .iter()
            .find_map(|(path, indexed)| (indexed.id == entry.id).then_some(path.clone()))
            .unwrap_or(path_key),
        &session.index,
    )
}

#[cfg(not(test))]
#[tauri::command]
fn write_document(
    state: State<'_, AppState>,
    request: WriteDocumentRequest,
) -> CommandResult<DocumentSnapshot> {
    let mut guard = state
        .session
        .lock()
        .map_err(|_| CommandError::new("STATE_LOCKED", "Workspace state is unavailable."))?;
    let session = require_session(&mut guard)?;
    let path = find_path_by_id(&session.index, &request.document_id)?;
    let target = safe_existing_path(&session.root, &path)?;
    let current_revision = revision_for(&target)?;
    if current_revision != request.base_revision {
        return Err(CommandError::revision_conflict(
            request.base_revision,
            current_revision,
        ));
    }

    atomic_write(&target, request.markdown.as_bytes())?;
    let entry = session
        .index
        .documents
        .get_mut(&path)
        .ok_or_else(|| CommandError::new("DOCUMENT_NOT_FOUND", "Document index entry is missing."))?;
    entry.revision = revision_for(&target)?;
    if let Some(title) = request.title {
        entry.title = Some(title);
    }
    if let Some(tags) = request.tags {
        entry.tags = tags;
    }
    save_index(&session.root, &session.index)?;
    snapshot_for_path(&session.root, &path, &session.index)
}

#[cfg(not(test))]
#[tauri::command]
fn move_node(
    state: State<'_, AppState>,
    request: MoveNodeRequest,
) -> CommandResult<WorkspaceNode> {
    let mut guard = state
        .session
        .lock()
        .map_err(|_| CommandError::new("STATE_LOCKED", "Workspace state is unavailable."))?;
    let session = require_session(&mut guard)?;
    let source_key = find_path_by_id(&session.index, &request.node_id)?;
    let source = safe_existing_path(&session.root, &source_key)?;
    let current_revision = revision_for(&source)?;
    if current_revision != request.base_revision {
        return Err(CommandError::revision_conflict(
            request.base_revision,
            current_revision,
        ));
    }

    let target_relative = validate_relative_path(&request.target_path)?;
    let target = prepare_new_file_path(&session.root, &target_relative)?;
    fs::rename(&source, &target)?;
    let entry = session
        .index
        .documents
        .remove(&source_key)
        .ok_or_else(|| CommandError::new("DOCUMENT_NOT_FOUND", "Document index entry is missing."))?;
    let target_key = logical_path(&target_relative);
    session.index.documents.insert(target_key.clone(), entry);
    save_index(&session.root, &session.index)?;
    let snapshot = snapshot_for_path(&session.root, &target_key, &session.index)?;
    Ok(WorkspaceNode::Document {
        id: snapshot.meta.id.clone(),
        name: target
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or("document.md")
            .to_owned(),
        path: snapshot.meta.path.clone(),
        meta: snapshot.meta,
    })
}

#[cfg(not(test))]
#[tauri::command]
fn delete_node(
    state: State<'_, AppState>,
    request: DeleteNodeRequest,
) -> CommandResult<()> {
    let mut guard = state
        .session
        .lock()
        .map_err(|_| CommandError::new("STATE_LOCKED", "Workspace state is unavailable."))?;
    let session = require_session(&mut guard)?;
    let source_key = find_path_by_id(&session.index, &request.node_id)?;
    let source = safe_existing_path(&session.root, &source_key)?;
    let current_revision = revision_for(&source)?;
    if current_revision != request.base_revision {
        return Err(CommandError::revision_conflict(
            request.base_revision,
            current_revision,
        ));
    }

    let trash = session.root.join(".inkloom").join("trash");
    fs::create_dir_all(&trash)?;
    let file_name = source
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("document.md");
    let target = trash.join(format!(
        "{}-{}-{}",
        unix_micros()?,
        request.node_id,
        file_name
    ));
    fs::rename(source, target)?;
    session.index.documents.remove(&source_key);
    save_index(&session.root, &session.index)?;
    Ok(())
}

#[cfg(not(test))]
fn require_session(
    guard: &mut Option<WorkspaceSession>,
) -> CommandResult<&mut WorkspaceSession> {
    guard.as_mut().ok_or_else(|| {
        CommandError::new(
            "WORKSPACE_NOT_OPEN",
            "Open a workspace before accessing documents.",
        )
    })
}

fn validate_relative_path(value: &str) -> CommandResult<PathBuf> {
    let normalized = value.replace('\\', "/");
    if value.contains('\0')
        || normalized.starts_with('/')
        || normalized.contains("://")
        || normalized
            .as_bytes()
            .get(1)
            .is_some_and(|separator| *separator == b':')
    {
        return Err(CommandError::new(
            "INVALID_WORKSPACE_PATH",
            "Workspace paths must be relative.",
        ));
    }

    let mut path = PathBuf::new();
    for segment in normalized.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err(CommandError::new(
                "INVALID_WORKSPACE_PATH",
                "Workspace paths cannot contain empty, dot, or parent segments.",
            ));
        }
        path.push(segment);
    }
    if path
        .components()
        .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(CommandError::new(
            "INVALID_WORKSPACE_PATH",
            "Workspace paths cannot contain platform roots.",
        ));
    }
    Ok(path)
}

fn safe_existing_path(root: &Path, relative: &str) -> CommandResult<PathBuf> {
    let relative = validate_relative_path(relative)?;
    reject_symlink_components(root, &relative)?;
    let target = root.join(relative);
    let canonical = target.canonicalize()?;
    ensure_inside(root, &canonical)?;
    Ok(canonical)
}

fn prepare_new_file_path(root: &Path, relative: &Path) -> CommandResult<PathBuf> {
    reject_symlink_components(root, relative)?;
    let target = root.join(relative);
    let parent = target
        .parent()
        .ok_or_else(|| CommandError::new("INVALID_WORKSPACE_PATH", "File path has no parent."))?;
    fs::create_dir_all(parent)?;
    let canonical_parent = parent.canonicalize()?;
    ensure_inside(root, &canonical_parent)?;
    reject_symlink_components(root, relative)?;
    if target.exists() {
        return Err(CommandError::new(
            "DOCUMENT_EXISTS",
            "A file already exists at this path.",
        ));
    }
    Ok(target)
}

fn ensure_inside(root: &Path, target: &Path) -> CommandResult<()> {
    if !target.starts_with(root) {
        return Err(CommandError::new(
            "INVALID_WORKSPACE_PATH",
            "The resolved path leaves the workspace.",
        ));
    }
    Ok(())
}

fn reject_symlink_components(root: &Path, relative: &Path) -> CommandResult<()> {
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(segment) = component else {
            return Err(CommandError::new(
                "INVALID_WORKSPACE_PATH",
                "Workspace path contains an unsupported component.",
            ));
        };
        current.push(segment);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(CommandError::new(
                    "SYMLINK_REJECTED",
                    "Symbolic links are not allowed inside an InkLoom workspace.",
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => break,
            Err(error) => return Err(error.into()),
        }
    }
    Ok(())
}

fn load_index(root: &Path) -> CommandResult<WorkspaceIndex> {
    let path = root.join(".inkloom").join("workspace-index.json");
    if !path.exists() {
        return Ok(WorkspaceIndex::default());
    }
    let raw = fs::read_to_string(path)?;
    serde_json::from_str(&raw)
        .map_err(|error| CommandError::new("INDEX_CORRUPT", error.to_string()))
}

fn save_index(root: &Path, index: &WorkspaceIndex) -> CommandResult<()> {
    let path = root.join(".inkloom").join("workspace-index.json");
    let json = serde_json::to_vec_pretty(index)
        .map_err(|error| CommandError::new("INDEX_SERIALIZE_FAILED", error.to_string()))?;
    atomic_write(&path, &json)
}

fn sync_index(root: &Path, index: &mut WorkspaceIndex) -> CommandResult<()> {
    let mut discovered = BTreeMap::<String, Revision>::new();
    collect_markdown_paths(root, root, &mut discovered)?;
    index
        .documents
        .retain(|path, _| discovered.contains_key(path));
    for (path, revision) in discovered {
        index
            .documents
            .entry(path)
            .and_modify(|entry| entry.revision = entry.revision.max(revision))
            .or_insert_with(|| IndexedDocument {
                id: next_document_id(),
                revision,
                title: None,
                tags: vec![],
            });
    }
    Ok(())
}

fn collect_markdown_paths(
    root: &Path,
    directory: &Path,
    documents: &mut BTreeMap<String, Revision>,
) -> CommandResult<()> {
    let mut entries = fs::read_dir(directory)?.collect::<Result<Vec<_>, _>>()?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        if file_type.is_dir() {
            if entry.file_name() != ".inkloom" {
                collect_markdown_paths(root, &path, documents)?;
            }
        } else if path.extension() == Some(OsStr::new("md")) {
            let relative = path
                .strip_prefix(root)
                .map_err(|_| CommandError::new("INVALID_WORKSPACE_PATH", "Path escaped root."))?;
            documents.insert(logical_path(relative), revision_for(&path)?);
        }
    }
    Ok(())
}

fn build_tree(root: &Path, index: &WorkspaceIndex) -> CommandResult<WorkspaceNode> {
    let mut children = Vec::new();
    collect_tree_children(root, root, index, &mut children)?;
    Ok(WorkspaceNode::Folder {
        id: "workspace-root".into(),
        name: root
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or("Workspace")
            .to_owned(),
        path: "workspace".into(),
        children,
    })
}

fn collect_tree_children(
    root: &Path,
    directory: &Path,
    index: &WorkspaceIndex,
    output: &mut Vec<WorkspaceNode>,
) -> CommandResult<()> {
    let mut entries = fs::read_dir(directory)?.collect::<Result<Vec<_>, _>>()?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if file_type.is_dir() {
            if name == ".inkloom" {
                continue;
            }
            let relative = path
                .strip_prefix(root)
                .map_err(|_| CommandError::new("INVALID_WORKSPACE_PATH", "Path escaped root."))?;
            let relative_string = logical_path(relative);
            let mut children = Vec::new();
            collect_tree_children(root, &path, index, &mut children)?;
            output.push(WorkspaceNode::Folder {
                id: format!("folder:{relative_string}"),
                name,
                path: relative_string,
                children,
            });
        } else if path.extension() == Some(OsStr::new("md")) {
            let relative = path
                .strip_prefix(root)
                .map_err(|_| CommandError::new("INVALID_WORKSPACE_PATH", "Path escaped root."))?;
            let relative_string = logical_path(relative);
            let snapshot = snapshot_for_path(root, &relative_string, index)?;
            output.push(WorkspaceNode::Document {
                id: snapshot.meta.id.clone(),
                name,
                path: relative_string,
                meta: snapshot.meta,
            });
        }
    }
    Ok(())
}

fn find_path_by_id(index: &WorkspaceIndex, document_id: &str) -> CommandResult<String> {
    index
        .documents
        .iter()
        .find_map(|(path, entry)| (entry.id == document_id).then_some(path.clone()))
        .ok_or_else(|| CommandError::new("DOCUMENT_NOT_FOUND", "Document is not in the workspace."))
}

fn snapshot_for_path(
    root: &Path,
    relative: &str,
    index: &WorkspaceIndex,
) -> CommandResult<DocumentSnapshot> {
    let path = safe_existing_path(root, relative)?;
    let markdown = fs::read_to_string(&path)?;
    let indexed = index.documents.get(relative).ok_or_else(|| {
        CommandError::new("DOCUMENT_NOT_FOUND", "Document index entry is missing.")
    })?;
    let metadata = fs::metadata(&path)?;
    Ok(DocumentSnapshot {
        meta: DocumentMeta {
            id: indexed.id.clone(),
            workspace_id: "local".into(),
            path: relative.into(),
            title: indexed
                .title
                .clone()
                .unwrap_or_else(|| title_from(&markdown, &path)),
            tags: indexed.tags.clone(),
            revision: indexed.revision.max(revision_for(&path)?),
            content_hash: content_hash(&markdown),
            created_at: system_time(metadata.created().unwrap_or_else(|_| {
                metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH)
            }))?,
            updated_at: system_time(metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH))?,
        },
        markdown,
    })
}

fn title_from(markdown: &str, path: &Path) -> String {
    markdown
        .lines()
        .find_map(|line| line.strip_prefix("# ").map(str::trim))
        .filter(|title| !title.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            path.file_stem()
                .and_then(OsStr::to_str)
                .map(str::to_owned)
        })
        .unwrap_or_else(|| "Untitled".into())
}

fn atomic_write(target: &Path, bytes: &[u8]) -> CommandResult<()> {
    let parent = target.parent().ok_or_else(|| {
        CommandError::new("INVALID_WORKSPACE_PATH", "Target path has no parent.")
    })?;
    let mut temporary = Builder::new()
        .prefix(".inkloom-save-")
        .tempfile_in(parent)?;
    temporary.write_all(bytes)?;
    temporary.flush()?;
    temporary.as_file().sync_all()?;
    let temporary_path = temporary.into_temp_path();
    if target.exists() {
        replace_file(&temporary_path, target)?;
    } else {
        fs::rename(&temporary_path, target)?;
    }
    Ok(())
}

#[cfg(windows)]
fn replace_file(source: &Path, target: &Path) -> CommandResult<()> {
    use std::{os::windows::ffi::OsStrExt, ptr};
    use windows_sys::Win32::Foundation::GetLastError;

    let source_wide = source
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let target_wide = target
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let replaced = unsafe {
        ReplaceFileW(
            target_wide.as_ptr(),
            source_wide.as_ptr(),
            ptr::null(),
            0,
            ptr::null_mut(),
            ptr::null_mut(),
        )
    };
    if replaced == 0 {
        let error = unsafe { GetLastError() };
        return Err(io::Error::from_raw_os_error(error as i32).into());
    }
    Ok(())
}

#[cfg(not(windows))]
fn replace_file(source: &Path, target: &Path) -> CommandResult<()> {
    fs::rename(source, target)?;
    Ok(())
}

fn revision_for(path: &Path) -> CommandResult<Revision> {
    let modified = fs::metadata(path)?
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH);
    Ok(u64::try_from(modified.duration_since(UNIX_EPOCH).unwrap_or_default().as_micros())
        .unwrap_or(Revision::MAX)
        .max(1))
}

fn unix_micros() -> CommandResult<u128> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros())
}

fn next_document_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    format!(
        "doc-{}-{}",
        unix_micros().unwrap_or_default(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

fn logical_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(value) => Some(value.to_string_lossy()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn content_hash(markdown: &str) -> String {
    let mut digest = Sha256::new();
    digest.update(markdown.as_bytes());
    format!("{:x}", digest.finalize())
}

fn system_time(value: SystemTime) -> CommandResult<String> {
    let date: DateTime<Utc> = value.into();
    Ok(date.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
}

#[cfg(not(test))]
fn watch_workspace(root: &Path, app: AppHandle) -> CommandResult<RecommendedWatcher> {
    let root_for_callback = root.to_path_buf();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else {
            return;
        };
        if matches!(event.kind, EventKind::Access(_)) {
            return;
        }
        let relevant = event.paths.iter().any(|path| {
            path.extension() == Some(OsStr::new("md"))
                && path
                    .strip_prefix(&root_for_callback)
                    .is_ok_and(|relative| !relative.starts_with(".inkloom"))
        });
        if relevant {
            let _ = app.emit("workspace-changed", ());
        }
    })
    .map_err(|error| CommandError::new("FILE_WATCH_FAILED", error.to_string()))?;
    watcher
        .watch(root, RecursiveMode::Recursive)
        .map_err(|error| CommandError::new("FILE_WATCH_FAILED", error.to_string()))?;
    Ok(watcher)
}

#[cfg(not(test))]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            open_workspace,
            current_workspace,
            list_tree,
            read_document,
            create_document,
            write_document,
            move_node,
            delete_node
        ])
        .run(tauri::generate_context!())
        .expect("failed to run InkLoom desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_test_workspace() -> (tempfile::TempDir, WorkspaceSession) {
        let directory = tempfile::tempdir().unwrap();
        let session = WorkspaceSession::open(directory.path().to_path_buf()).unwrap();
        (directory, session)
    }

    #[test]
    fn rejects_absolute_and_parent_paths() {
        assert!(validate_relative_path("C:\\secret.md").is_err());
        assert!(validate_relative_path("/secret.md").is_err());
        assert!(validate_relative_path("../secret.md").is_err());
        assert!(validate_relative_path("docs//secret.md").is_err());
        assert!(validate_relative_path("docs/./secret.md").is_err());
    }

    #[test]
    fn creates_and_atomically_updates_markdown() {
        let (directory, mut session) = open_test_workspace();
        let request = CreateDocumentRequest {
            path: "产品/路线图.md".into(),
            title: "路线图".into(),
            markdown: Some("# 路线图\n".into()),
        };
        let relative = validate_relative_path(&request.path).unwrap();
        let target = prepare_new_file_path(&session.root, &relative).unwrap();
        fs::write(&target, request.markdown.unwrap()).unwrap();
        session.index.documents.insert(
            logical_path(&relative),
            IndexedDocument {
                id: "doc-test".into(),
                revision: revision_for(&target).unwrap(),
                title: None,
                tags: vec![],
            },
        );

        atomic_write(&target, b"# Updated\n").unwrap();

        assert_eq!(fs::read_to_string(&target).unwrap(), "# Updated\n");
        assert!(directory
            .path()
            .read_dir()
            .unwrap()
            .all(|entry| !entry.unwrap().file_name().to_string_lossy().contains("inkloom-save")));
    }

    #[test]
    fn detects_stale_revisions_before_writing() {
        let (_directory, session) = open_test_workspace();
        let relative = validate_relative_path("个人/冲突.md").unwrap();
        let target = prepare_new_file_path(&session.root, &relative).unwrap();
        fs::write(&target, "# A\n").unwrap();
        let actual = revision_for(&target).unwrap();

        let error = CommandError::revision_conflict(actual.saturating_sub(1), actual);
        assert_eq!(error.code, "REVISION_CONFLICT");
        assert_eq!(error.current_revision, Some(actual));
    }
}
