# @inkloom/storage

定义浏览器、Tauri、Harmony 和云端工作区 adapter。当前 Web 原型仍使用 `localStorage`，T3 时迁移到 BrowserLocalAdapter。

adapter 必须显式暴露能力，不允许 UI 猜测某个平台是否支持本地目录写入。

所有 adapter 必须通过共同契约测试：目录枚举、读文档、创建、带 revision 写入、移动、删除、冲突返回和权限错误。
