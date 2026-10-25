/**
 * 故事模式插件的 Host 入口。
 *
 * 真正的能力都在预设子行里：
 * - `./story-guard`：屏蔽部署级全局工具；
 * - `./choices`：/choices 命令、storyChoices 投影和「三条走向」运行时上下文。
 * 这个入口只作为 bundle 的插件行存在（客户端半体是 `./client`，由 dsh.client 声明加载）。
 */
export function apply() {}
