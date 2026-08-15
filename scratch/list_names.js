const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const keyMatch = envContent.match(/GEMINI_API_KEY=(.*)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

const ai = new GoogleGenAI({ apiKey });

async function main() {
  try {
    const list = await ai.models.list();
    console.log("Model Names:");
    for (const m of list) {
      console.log(m.name);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
