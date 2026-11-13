# @inkloom/sync

文件 revision 同步、本地离线队列、冲突副本和 Yjs 会话协调。

文件同步与字符级 CRDT 必须保持职责分离。实时会话结束后由单写者固化 Markdown。

移动端在进程被系统终止后必须能从未同步操作队列恢复；Bridge 或网络不可用只能进入降级状态，不能丢失本地 revision。
