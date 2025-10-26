// main.js - Popup script
document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("gpt-extractor-button");
  if (button) {
    button.addEventListener("click", extractQueries);
  } else {
    console.error("Button with id 'gpt-extractor-button' not found.");
  }
});

const extractQueries = async () => {
  try {
    console.log("Starting extraction process...");
    const button = document.getElementById("gpt-extractor-button");
    button.textContent = "Extracting...";
    button.disabled = true;

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes("chatgpt.com")) {
      alert("Please navigate to a ChatGPT conversation page first!");
      resetButton();
      return;
    }

    // First, try to ping the content script to see if it's ready
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "ping" });
    } catch (pingError) {
      console.log("Content script not ready, attempting to inject...");
      
      // Try to inject content script programmatically
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js']
        });
        
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (injectError) {
        console.error("Failed to inject content script:", injectError);
        alert("Failed to initialize extension. Please refresh the ChatGPT page and try again.");
        resetButton();
        return;
      }
    }

    // Now send the actual extraction message
    console.log("Sending extraction message...");
    const response = await chrome.tabs.sendMessage(tab.id, { action: "extractQueries" });
    
    if (response.success) {
      console.log("Success! Messages:", response.messages);
      console.log("Search queries:", response.queries);
      console.log("Search nodes:", response.searchNodes);
      
      // Display success message
      //alert(`Success! Found ${response.queries.length} search queries and ${response.messages.length} messages.\n\nCheck console for details.`);
    } else {
      console.error("Extraction failed:", response.error);
      //alert("Error extracting queries: " + response.error);
    }
    
  } catch (error) {
    console.error("Communication error:", error);
    
    if (error.message?.includes("Receiving end does not exist")) {
      alert("Extension not ready. Please refresh the ChatGPT page and try again.");
    } else {
      alert("Error: " + error.message);
    }
  } finally {
    resetButton();
  }
};

function resetButton() {
  const button = document.getElementById("gpt-extractor-button");
  if (button) {
    button.textContent = "Extract queries";
    button.disabled = false;
  }
}