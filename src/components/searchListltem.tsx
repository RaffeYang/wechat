import { Action, ActionPanel, closeMainWindow, environment, Icon, List, showToast, Toast } from "@raycast/api"
import path from "path"
import { storageService } from "../services/storageService"
import { wechatService } from "../services/wechatService"
import { SearchResult } from "../types"

interface SearchListItemProps {
  searchResult: SearchResult
  isPinned: boolean
  onTogglePin: () => void
  onClearHistory: () => void
  onGenerateAiMessage: () => void // 新增的属性
}

export function SearchListItem({ searchResult, isPinned, onTogglePin, onClearHistory, onGenerateAiMessage }: SearchListItemProps) {
  const defaultAvatarPath = path.join(environment.assetsPath, "avatar.png")

  async function startWeChat() {
    try {
      await wechatService.startChat(searchResult.arg)
      await storageService.addRecentContact(searchResult)
      await closeMainWindow({ clearRootSearch: true })
    } catch (error) {
      console.error("Failed to open WeChat chat:", error)
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to open WeChat chat",
        message: String(error),
      })
    }
  }

  const title = searchResult.title || searchResult.subtitle || searchResult.arg
  const avatarPath = searchResult.icon.path || defaultAvatarPath

  return (
    <List.Item
      title={title}
      // subtitle={searchResult.subtitle}
      accessories={[
        {
          text: searchResult.arg,
          icon: isPinned ? { source: Icon.Pin } : undefined,
        },
      ]}
      icon={avatarPath}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action icon={Icon.Message} title="聊天" onAction={startWeChat} />
            <Action icon={Icon.Wand} title="生成 AI 消息" onAction={onGenerateAiMessage} shortcut={{ modifiers: ["cmd"], key: "g" }} />
            <Action.CopyToClipboard
              icon={Icon.Clipboard}
              title="复制微信 ID"
              content={searchResult.arg}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.CopyToClipboard
              icon={Icon.Clipboard}
              title="复制快速访问 URL"
              content={searchResult.url}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
            <Action
              icon={isPinned ? Icon.PinDisabled : Icon.Pin}
              title={isPinned ? "取消置顶联系人" : "置顶联系人"}
              onAction={onTogglePin}
              shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
            />
            <Action
              icon={Icon.Trash}
              title="清除搜索历史"
              onAction={onClearHistory}
              shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
            />
            <Action.OpenInBrowser
              title="功能请求"
              url="https://github.com/raffeyang/wechat"
              shortcut={{ modifiers: ["cmd"], key: "h" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  )
}
