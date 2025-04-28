import { AI, Clipboard, confirmAlert, launchCommand, LaunchType, List, showToast, Toast } from "@raycast/api"
import { useEffect, useState } from "react"
import { SearchListItem } from "./components/searchListltem"
import { useSearch } from "./hooks/useSearch"
import { storageService } from "./services/storageService"
import { SearchResult } from "./types"
import { WeChatManager } from "./utils/wechatManager"

export default function Command() {
  const [isInitializing, setIsInitializing] = useState(true)
  const [environmentReady, setEnvironmentReady] = useState(false)
  const { state, search, clearRecentContacts } = useSearch()
  const [pinnedContacts, setPinnedContacts] = useState<SearchResult[]>([])
  const [aiProcessing, setAiProcessing] = useState(false)
  const [aiQuery, setAiQuery] = useState("")

  useEffect(() => {
    checkRequirements()
    loadPinnedContacts()
  }, [])

  // Add this new effect to handle AI queries
  useEffect(() => {
    if (aiQuery && environmentReady && !aiProcessing) {
      processAiQuery(aiQuery)
    }
  }, [aiQuery, environmentReady, aiProcessing])

  // Analyze query intent using AI
  const processAiQuery = async (text: string) => {
    if (!text) return
    
    setAiProcessing(true)
    try {
      // Using AI to extract search keywords
      const response = await AI.ask(`
        如果这个查询是在寻找一个微信联系人，请提取出联系人的名字或关键词。
        如果不是在寻找联系人，请回复 "NO_SEARCH_INTENT"。
        
        查询: "${text}"
        
        只返回联系人名字或关键词，不要添加任何其他文字。如果没有搜索意图，只返回 "NO_SEARCH_INTENT"。
      `)
      
      const searchKeyword = response.trim()
      if (searchKeyword && searchKeyword !== "NO_SEARCH_INTENT") {
        // Search contacts using extracted keywords
        search(searchKeyword)
        
        await showToast({
          style: Toast.Style.Success,
          title: `AI Search`,
          message: `Search: "${searchKeyword}"`,
        })
      }
    } catch (error) {
      console.error("AI processing error:", error)
      showToast({
        style: Toast.Style.Failure,
        title: "AI Handling failure",
        message: String(error),
      })
    } finally {
      setAiProcessing(false)
    }
  }

  // Generate AI conversation content
  const generateAiMessage = async (contactName: string) => {
    try {
      await showToast({
        style: Toast.Style.Animated,
        title: "AI Generating Message...",
      })
      
      const response = await AI.ask(`
        请为我生成一条发送给 ${contactName} 的微信消息。
        生成一条自然、友好、简洁的消息。
        直接给出消息内容，不要添加任何前缀或说明。
      `)
      
      // Copy to Clipboard
      await Clipboard.copy(response.trim())
      
      await showToast({
        style: Toast.Style.Success,
        title: "消息已生成",
        message: "内容已复制到剪贴板",
      })
    } catch (error) {
      console.error("Failed to generate AI message:", error)
      showToast({
        style: Toast.Style.Failure,
        title: "生成消息失败",
        message: String(error),
      })
    }
  }

  const openManageTweak = async () => {
    try {
      await launchCommand({
        name: "manageTweak",
        type: LaunchType.UserInitiated,
      })
    } catch (error) {
      console.error("Failed to launch manageTweak:", error)

      // 如果无法自动打开，显示提示
      await showToast({
        style: Toast.Style.Failure,
        title: "无法打开 WeChatTweak 管理器",
        message: "请手动打开 WeChatTweak 管理器",
      })
    }
  }

  const checkRequirements = async () => {
    try {
      let requirementsMessage = ""
      let shouldOpenManager = false

      // 检查 WeChat 是否已安装
      const isWeChatInstalled = WeChatManager.isWeChatInstalled()
      if (!isWeChatInstalled) {
        requirementsMessage = "未安装 WeChat。是否打开 WeChatTweak 管理器进行安装？"
        shouldOpenManager = true
      }
      // 检查 WeChat 是否正在运行
      else if (!WeChatManager.isWeChatRunning()) {
        requirementsMessage = "WeChat 未运行。是否打开 WeChatTweak 管理器启动它？"
        shouldOpenManager = true
      }
      // 检查 WeChatTweak 是否已安装
      else if (!WeChatManager.isWeChatTweakInstalled()) {
        requirementsMessage = "未安装 WeChatTweak。是否打开 WeChatTweak 管理器进行安装？"
        shouldOpenManager = true
      }
      // 检查 WeChatTweak 是否已安装
      else {
        try {
          const isServiceRunning = await WeChatManager.isWeChatServiceRunning()
          if (!isServiceRunning) {
            requirementsMessage =
              "WeChat 服务未运行。是否打开 WeChatTweak 管理器解决此问题？"
            shouldOpenManager = true
          }
        } catch (serviceError) {
          console.error("Error checking WeChat service:", serviceError)
          requirementsMessage =
            "检查 WeChat 服务失败。是否打开 WeChatTweak 管理器解决此问题？"
          shouldOpenManager = true
        }
      }

      if (shouldOpenManager) {
        // 如果环境不满足，显示确认对话框
        setIsInitializing(false)
        setEnvironmentReady(false)

        // 使用 confirmAlert 并处理返回值
        const confirmed = await confirmAlert({
          title: "环境未就绪",
          message: requirementsMessage,
          primaryAction: {
            title: "打开 WeChatTweak 管理器",
          },
          dismissAction: {
            title: "取消",
          },
        })

        // 如果用户点击主要操作按钮，打开管理 WeChatTweak 命令
        if (confirmed) {
          await openManageTweak()
        }

        return
      }

      // 所有条件都满足
      setEnvironmentReady(true)
      setIsInitializing(false)
    } catch (error) {
      console.error("Error checking requirements:", error)
      setIsInitializing(false)
      setEnvironmentReady(false)

      // 显示错误消息并提供打开管理界面的选项
      const confirmed = await confirmAlert({
        title: "检查要求时出错",
        message: `检查要求时发生错误：${error}。是否打开 WeChatTweak 管理器解决此问题？`,
        primaryAction: {
          title: "打开 WeChatTweak 管理器",
        },
        dismissAction: {
          title: "取消",
        },
      })

      if (confirmed) {
        await openManageTweak()
      }
    }
  }

  const loadPinnedContacts = async () => {
    try {
      const contacts = await storageService.getPinnedContacts()
      setPinnedContacts(contacts)
    } catch (error) {
      console.error("Error loading pinned contacts:", error)
    }
  }

  if (isInitializing) {
    return (
      <List isLoading={true}>
        <List.EmptyView
          title="正在检查要求..."
          description="请稍候，我们正在检查 WeChat 和 WeChatTweak 安装情况。"
        />
      </List>
    )
  }

  if (!environmentReady) {
    return (
      <List>
        <List.EmptyView
          title="环境未就绪"
          description="WeChat 或 WeChatTweak 未正确设置。请使用 WeChatTweak 管理器解决此问题。"
          actions={
            <ActionPanel>
              <ActionPanel.Item title="打开 WeChatTweak 管理器" onAction={openManageTweak} />
            </ActionPanel>
          }
        />
      </List>
    )
  }

  return (
    <List
      isLoading={state.isLoading || aiProcessing}
      onSearchTextChange={(text) => {
        // 检查这是否可能是 AI 查询
        if (text.toLowerCase().includes("搜索") || 
          text.toLowerCase().includes("查找") || 
          text.toLowerCase().includes("找")) {
          setAiQuery(text)
        } else {
          search(text)
        }
      }}
      searchBarPlaceholder="搜索微信联系人或使用自然语言 (例如: '搜索李建国')"
      throttle
    >
      {pinnedContacts.length > 0 && (
        <List.Section title="置顶联系人" subtitle={String(pinnedContacts.length)}>
          {pinnedContacts.map((contact) => (
            <SearchListItem
              key={`pinned-${contact.arg}`}
              searchResult={contact}
              isPinned={true}
              onTogglePin={async () => {
                const newPinnedContacts = pinnedContacts.filter((c) => c.arg !== contact.arg)
                setPinnedContacts(newPinnedContacts)
                await storageService.setPinnedContacts(newPinnedContacts)
              }}
              onClearHistory={clearRecentContacts}
              onGenerateAiMessage={() => generateAiMessage(contact.title)}
            />
          ))}
        </List.Section>
      )}

      {state.recentContacts.length > 0 && state.searchText === "" && (
        <List.Section title="最近联系人" subtitle={String(state.recentContacts.length)}>
          {state.recentContacts.map((contact) => {
            const isAlreadyPinned = pinnedContacts.some((pinned) => pinned.arg === contact.arg)
            if (isAlreadyPinned) {
              return null
            }

            return (
              <SearchListItem
                key={`recent-${contact.arg}`}
                searchResult={contact}
                isPinned={false}
                onTogglePin={async () => {
                  const newPinnedContacts = [...pinnedContacts, contact]
                  setPinnedContacts(newPinnedContacts)
                  await storageService.setPinnedContacts(newPinnedContacts)
                }}
                onClearHistory={clearRecentContacts}
                onGenerateAiMessage={() => generateAiMessage(contact.title)}
              />
            )
          })}
        </List.Section>
      )}

      <List.Section title="联系人" subtitle={String(state.items.length)}>
        {state.items.map((searchResult) => {
          const isAlreadyPinned = pinnedContacts.some((contact) => contact.arg === searchResult.arg)
          if (isAlreadyPinned) {
            return null
          }

          return (
            <SearchListItem
              key={searchResult.arg}
              searchResult={searchResult}
              isPinned={false}
              onTogglePin={async () => {
                const newPinnedContacts = [...pinnedContacts, searchResult]
                setPinnedContacts(newPinnedContacts)
                await storageService.setPinnedContacts(newPinnedContacts)
              }}
              onClearHistory={clearRecentContacts}
              onGenerateAiMessage={() => generateAiMessage(searchResult.title)}
            />
          )
        })}
      </List.Section>
    </List>
  )
}

import { ActionPanel } from "@raycast/api"

