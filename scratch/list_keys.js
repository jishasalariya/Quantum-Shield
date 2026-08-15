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
    const response = await ai.models.list();
    console.log("Response keys:", Object.keys(response));
    
    // Let's inspect properties that might contain the list
    for (const key of Object.keys(response)) {
      const val = response[key];
      if (Array.isArray(val)) {
        console.log(`Key '${key}' is an array of length ${val.length}`);
        if (val.length > 0) {
          console.log(`First item keys:`, Object.keys(val[0]));
          console.log(`First item name:`, val[0].name);
        }
      } else {
        console.log(`Key '${key}' is of type ${typeof val}`);
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
