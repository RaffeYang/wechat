import { AI, } from "@raycast/api"
import { loadContacts } from "../services/contactLoader"

export default async function WeChatAI() {
  console.log("=== WeChat AI Tool Launched ===")
  
  try {
    // Loading contact data
    const contacts = await loadContacts()
    console.log(`[WeChat AI] Successfully loaded ${contacts.length} contact data.`)
    
    // Retrieve a list of contact names
    const contactNames = contacts.map(contact => contact.title)
    
    // Send to AI
    const analysis = await AI.ask(`
      以下是我的微信联系人名称列表(共${contactNames.length}人):
      
      ${contactNames.join('\n')}
      
      请记住这些联系人名称，以便回答我关于这些联系人的任何问题。
      例如"姓杨的有几个"、"三个字的名字有哪些"等。
      
      现在，请简要分析一下我的联系人情况。
    `)
    
    return analysis
  } catch (error) {
    console.error("[WeChat AI] Execution failed：", error)
    throw error
  } finally {
    console.log("=== WeChat AI Tool Ends ===")
  }
}
