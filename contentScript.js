// contentScript.js
console.log("ChatGPT Query Extractor content script loaded");

let isReady = false;

// Function to handle message from popup
const handleMessage = (request, sender, sendResponse) => {
  if (request.action === "extractQueries") {
    console.log("Extraction request received");
    extractQueries()
      .then(result => {
        sendResponse({ success: true, ...result });
      })
      .catch(error => {
        console.error("Extraction error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === "ping") {
    sendResponse({ success: true, ready: true });
    return true;
  }
};

// Add listener when content script loads
chrome.runtime.onMessage.addListener(handleMessage);

// Signal that content script is ready
isReady = true;
console.log("ChatGPT Query Extractor content script ready");

const extractQueries = async () => {
  try {
    console.log("Starting query extraction...");
    
    const loc = window.location.href;
    console.log("Current URL:", loc);
    
    // Extract conversation ID from URL - handle different URL patterns
    const urlParts = loc.split('/');
    const cId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
    
    if (!cId || cId === 'c') {
      throw new Error("No conversation ID found in URL. Please open a specific ChatGPT conversation.");
    }
    
    console.log("Conversation ID:", cId);
    
    const sUrl = "https://chatgpt.com/api/auth/session";
    const bUrl = "https://chatgpt.com/backend-api/conversation/";

    // Get session
    console.log("Fetching session...");
    const sessionResponse = await fetch(sUrl);
    if (!sessionResponse.ok) {
      throw new Error(`Session fetch failed! status ${sessionResponse.status}`);
    }
    const sessionData = await sessionResponse.json();
    
    if (!sessionData.accessToken) {
      throw new Error("No access token found. Please make sure you're logged into ChatGPT.");
    }

    console.log("Fetching conversation data...");
    // Get conversation
    const conversationResponse = await fetch(bUrl + cId, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.accessToken}`,
      },
    });

    if (!conversationResponse.ok) {
      throw new Error(`Conversation fetch failed! status ${conversationResponse.status}`);
    }

    const conversation = await conversationResponse.json();
    console.log("Conversation data received");

    // Extract plain messages
    const messages = Object.values(conversation.mapping)
      .filter((node) => node.message && node.message.content?.parts)
      .map((node) => ({
        role: node.message.author.role,
        text: node.message.content.parts.join("\n"),
      }));

    // Extract search queries
    const searchNodes = Object.values(conversation.mapping)
      .filter(
        (node) =>
          node.message?.metadata?.search_model_queries?.queries?.length > 0
      )
      .map((node) => ({
        nodeId: node.id,
        role: node.message.author.role,
        queries: node.message.metadata.search_model_queries?.queries,
      }));

    const queries = Object.values(conversation.mapping).flatMap(
      (node) => node.message?.metadata?.search_model_queries?.queries || []
    );

    // Extract thoughts
    const thoughts = Object.values(conversation.mapping)
      .filter((node) => 
        node.message?.content?.content_type === "thoughts" && 
        node.message?.content?.thoughts?.length > 0
      )
      .map((node) => ({
        nodeId: node.id,
        role: node.message.author.role,
        thoughts: node.message.content.thoughts.map(thought => ({
          summary: thought.summary,
          content: thought.content,
          chunks: thought.chunks || [],
          finished: thought.finished || false
        }))
      }));

    console.log(`Extracted ${queries.length} queries, ${messages.length} messages, and ${thoughts.length} thought nodes`);

    console.log(`Messages: ${messages}`);
    console.log(`Queries: ${queries}`);
    console.log(`Thoughts: ${thoughts}`);
    
    return {
      messages,
      searchNodes,
      queries,
      thoughts,
      conversationId: cId
    };
  } catch (error) {
    console.error("Error extracting queries:", error);
    throw error;
  }
};