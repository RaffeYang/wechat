import {
  Action,
  ActionPanel,
  AI,
  Clipboard,
  confirmAlert,
  launchCommand,
  LaunchType,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { SearchListItem } from "./components/searchListltem";
import { useSearch } from "./hooks/useSearch";
import { storageService } from "./services/storageService";
import { SearchResult } from "./types";
import { WeChatManager } from "./utils/wechatManager";

export default function Command() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [environmentReady, setEnvironmentReady] = useState(false);
  const { state, search, clearRecentContacts } = useSearch();
  const [pinnedContacts, setPinnedContacts] = useState<SearchResult[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiQuery, setAiQuery] = useState("");

  useEffect(() => {
    checkRequirements();
    loadPinnedContacts();
  }, []);

  // Add this new effect to handle AI queries
  useEffect(() => {
    if (aiQuery && environmentReady && !aiProcessing) {
      processAiQuery(aiQuery);
    }
  }, [aiQuery, environmentReady, aiProcessing]);

  // Analyze query intent using AI
  const processAiQuery = async (text: string) => {
    if (!text) return;

    setAiProcessing(true);
    try {
      // Using AI to extract search keywords
      const response = await AI.ask(`
        如果这个查询是在寻找一个微信联系人，请提取出联系人的名字或关键词。
        如果不是在寻找联系人，请回复 "请输入和联系人相关的问题"。
        
        查询: "${text}"
        
        只返回联系人名字或关键词，不要添加任何其他文字。如果没有搜索意图，只返回 "不支持的搜索内容"。
      `);

      const searchKeyword = response.trim();
      if (searchKeyword && searchKeyword !== "NO_SEARCH_INTENT") {
        // Search contacts using extracted keywords
        search(searchKeyword);

        await showToast({
          style: Toast.Style.Success,
          title: `AI Search`,
          message: `Search: "${searchKeyword}"`,
        });
      }
    } catch (error) {
      console.error("AI processing error:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "AI Handling failure",
        message: String(error),
      });
    } finally {
      setAiProcessing(false);
    }
  };

  // Generate AI conversation content
  const generateAiMessage = async (contactName: string) => {
    try {
      await showToast({
        style: Toast.Style.Animated,
        title: "AI Generating Message...",
      });

      const response = await AI.ask(`
        请为我生成一条发送给 ${contactName} 的微信消息。
        生成一条自然、友好、简洁的消息。
        直接给出消息内容，不要添加任何前缀或说明。
      `);

      // Copy to Clipboard
      await Clipboard.copy(response.trim());

      await showToast({
        style: Toast.Style.Success,
        title: "Message Generated",
        message: "Content copied to clipboard",
      });
    } catch (error) {
      console.error("Failed to generate AI message:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to generate message",
        message: String(error),
      });
    }
  };

  const openManageTweak = async () => {
    try {
      await launchCommand({
        name: "manageTweak",
        type: LaunchType.UserInitiated,
      });
    } catch (error) {
      console.error("Failed to launch manageTweak:", error);

      // If it cannot be opened automatically, display a prompt
      await showToast({
        style: Toast.Style.Failure,
        title: "Unable to open WeChat Tweak Manager",
        message: "Please open WeChatTweak Manager manually",
      });
    }
  };

  const checkRequirements = async () => {
    try {
      let requirementsMessage = "";
      let shouldOpenManager = false;

      // Check if WeChat is installed
      const isWeChatInstalled = WeChatManager.isWeChatInstalled();
      if (!isWeChatInstalled) {
        requirementsMessage = "WeChat is not installed. Open WeChatTweak Manager to install it?";
        shouldOpenManager = true;
      }
      // Check if WeChat is running
      else if (!WeChatManager.isWeChatRunning()) {
        requirementsMessage = "WeChat is not running. Do you want to open WeChatTweak Manager to start it?";
        shouldOpenManager = true;
      }
      // Check if WeChatTweak is installed
      else if (!WeChatManager.isWeChatTweakInstalled()) {
        requirementsMessage = "WeChatTweak is not installed. Open WeChatTweak Manager to install it?";
        shouldOpenManager = true;
      }
      // Check if WeChatTweak is installed
      else {
        try {
          const isServiceRunning = await WeChatManager.isWeChatServiceRunning();
          if (!isServiceRunning) {
            requirementsMessage = "WeChat service is not running. Open WeChat Tweak Manager to fix this problem?";
            shouldOpenManager = true;
          }
        } catch (serviceError) {
          console.error("Error checking WeChat service:", serviceError);
          requirementsMessage = "Checking WeChat service failed. Open WeChat Tweak Manager to fix this?";
          shouldOpenManager = true;
        }
      }

      if (shouldOpenManager) {
        // If the environment is not satisfied, a confirmation dialog box is displayed
        setIsInitializing(false);
        setEnvironmentReady(false);

        // Use confirmAlert and handle the return value
        const confirmed = await confirmAlert({
          title: "Environment not ready",
          message: requirementsMessage,
          primaryAction: {
            title: "Open WeChat Tweak Manager",
          },
          dismissAction: {
            title: "Cancel",
          },
        });

        // If the user clicks the primary action button, open the Manage WeChatTweak command
        if (confirmed) {
          await openManageTweak();
        }

        return;
      }

      // All conditions are met
      setEnvironmentReady(true);
      setIsInitializing(false);
    } catch (error) {
      console.error("Error checking requirements:", error);
      setIsInitializing(false);
      setEnvironmentReady(false);

      // Display an error message and provide an option to open the management interface
      const confirmed = await confirmAlert({
        title: "Error checking request",
        message: `An error occurred while checking requirements: ${error}. Open WeChatTweak Manager to fix this?`,
        primaryAction: {
          title: "Open WeChat Tweak Manager",
        },
        dismissAction: {
          title: "Cancel",
        },
      });

      if (confirmed) {
        await openManageTweak();
      }
    }
  };

  const loadPinnedContacts = async () => {
    try {
      const contacts = await storageService.getPinnedContacts();
      setPinnedContacts(contacts);
    } catch (error) {
      console.error("Error loading pinned contacts:", error);
    }
  };

  if (isInitializing) {
    return (
      <List isLoading={true}>
        <List.EmptyView
          title="Checking requirements..."
          description="Please wait while we check WeChat and WeChatTweak installation."
        />
      </List>
    );
  }

  if (!environmentReady) {
    return (
      <List>
        <List.EmptyView
          title="Environment not ready"
          description="WeChat or WeChatTweak is not set up correctly. Please use WeChatTweak Manager to resolve this issue."
          actions={
            <ActionPanel.Section>
              <Action
                title="Open WeChatTweak Manager"
                icon="wechat.png"
                onAction={async () => {
                  await openManageTweak();
                }}
              />
            </ActionPanel.Section>
          }
        />
      </List>
    );
  }

  return (
    <List
      isLoading={state.isLoading || aiProcessing}
      onSearchTextChange={(text) => {
        // Check if this might be an AI query
        if (
          text.toLowerCase().includes("搜索") ||
          text.toLowerCase().includes("查找") ||
          text.toLowerCase().includes("找")
        ) {
          setAiQuery(text);
        } else {
          search(text);
        }
      }}
      searchBarPlaceholder="支持名字、拼音或者AI自然语言搜索..."
      throttle
    >
      {pinnedContacts.length > 0 && (
        <List.Section title="Pin Contact" subtitle={String(pinnedContacts.length)}>
          {pinnedContacts.map((contact) => (
            <SearchListItem
              key={`pinned-${contact.arg}`}
              searchResult={contact}
              isPinned={true}
              onTogglePin={async () => {
                const newPinnedContacts = pinnedContacts.filter((c) => c.arg !== contact.arg);
                setPinnedContacts(newPinnedContacts);
                await storageService.setPinnedContacts(newPinnedContacts);
              }}
              onClearHistory={clearRecentContacts}
              onGenerateAiMessage={() => generateAiMessage(contact.title)}
            />
          ))}
        </List.Section>
      )}

      {state.recentContacts.length > 0 && state.searchText === "" && (
        <List.Section title="Recent Contacts" subtitle={String(state.recentContacts.length)}>
          {state.recentContacts.map((contact) => {
            const isAlreadyPinned = pinnedContacts.some((pinned) => pinned.arg === contact.arg);
            if (isAlreadyPinned) {
              return null;
            }

            return (
              <SearchListItem
                key={`recent-${contact.arg}`}
                searchResult={contact}
                isPinned={false}
                onTogglePin={async () => {
                  const newPinnedContacts = [...pinnedContacts, contact];
                  setPinnedContacts(newPinnedContacts);
                  await storageService.setPinnedContacts(newPinnedContacts);
                }}
                onClearHistory={clearRecentContacts}
                onGenerateAiMessage={() => generateAiMessage(contact.title)}
              />
            );
          })}
        </List.Section>
      )}

      <List.Section title="Contacts" subtitle={String(state.items.length)}>
        {state.items.map((searchResult) => {
          const isAlreadyPinned = pinnedContacts.some((contact) => contact.arg === searchResult.arg);
          if (isAlreadyPinned) {
            return null;
          }

          return (
            <SearchListItem
              key={searchResult.arg}
              searchResult={searchResult}
              isPinned={false}
              onTogglePin={async () => {
                const newPinnedContacts = [...pinnedContacts, searchResult];
                setPinnedContacts(newPinnedContacts);
                await storageService.setPinnedContacts(newPinnedContacts);
              }}
              onClearHistory={clearRecentContacts}
              onGenerateAiMessage={() => generateAiMessage(searchResult.title)}
            />
          );
        })}
      </List.Section>
    </List>
  );
}
