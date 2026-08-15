const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const keyMatch = envContent.match(/GEMINI_API_KEY=(.*)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

console.log("Using API Key:", apiKey.substring(0, 12) + "...");

const ai = new GoogleGenAI({ apiKey });

async function main() {
  try {
    const response = await ai.models.list();
    console.log("\nSuccess! Raw models list:");
    if (response && response.models) {
      response.models.forEach(m => console.log(`- ${m.name}`));
    } else if (Array.isArray(response)) {
      response.forEach(m => console.log(`- ${m.name}`));
    } else {
      console.log(response);
    }
  } catch (err) {
    console.error("\nError listing models:", err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  }
}

main();
