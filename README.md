# Poetry Blackout

A fully automated, daily poetry generator that pulls random public-domain text from Project Gutenberg and uses the Gemini API to create blackout poetry. 

Every day at midnight, the bot fetches a new random page, redacts it to leave behind a beautiful, striking poem, and updates the website automatically.

## How It Works

This project runs completely serverless using **GitHub Actions** and **GitHub Pages**:

1. **The Automation (`.github/workflows/daily-poem.yml`)**: Every day at midnight UTC, a GitHub Action wakes up and runs `generate_poem.js`.
2. **The Source Material**: The script asks Gutendex (a public search API for Project Gutenberg) for a random English-language book, downloads its text, and crops out a 250-word segment.
3. **The Redaction**: The script sends those 250 words to the **Gemini API** using a prompt designed for blackout poetry. It asks Gemini to select 5–10 words that form an evocative poem without altering their original order.
4. **The Update**: The script saves the resulting poem and source metadata into `data/daily_poem.json` and automatically commits and pushes it to this repository.
5. **The Display**: GitHub Pages automatically rebuilds the site. When a user visits the webpage, `script.js` loads the new JSON data and animates the blackout effect.

## Setup Instructions

If you've cloned or forked this repository and want to run it yourself, you need to set up two things: your Gemini API key and GitHub Pages.

### 1. Add your Gemini API Key

Since the bot needs an API key to communicate with Gemini, you must provide it securely via GitHub Secrets.

1. Go to your repository on GitHub.
2. Click on **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret**.
4. Set the **Name** to: `GEMINI_API_KEY`
5. Set the **Secret** to your actual Gemini API key (you can get a free one from [Google AI Studio](https://aistudio.google.com/apikey)).
6. Click **Add secret**.

### 2. Enable GitHub Pages

To make the website accessible on the internet:

1. Go to your repository **Settings**.
2. On the left sidebar, click on **Pages**.
3. Under **Build and deployment**, set the **Source** to **Deploy from a branch**.
4. Select the **main** branch and the `/ (root)` folder.
5. Click **Save**. 

Within a few minutes, your site will be live!

### 3. Trigger the First Run

You don't have to wait until midnight for your first poem! You can trigger the bot manually:

1. Go to the **Actions** tab in your repository.
2. On the left, click **Generate Daily Poem**.
3. On the right, click the **Run workflow** dropdown and click the **Run workflow** button.
4. Wait for the action to complete. It will generate your first poem and update your website.

## Local Development

If you want to test the generation script locally:

1. Ensure you have Node.js installed (v18+ recommended for native `fetch`).
2. Set your environment variable:
   - On Windows: `set GEMINI_API_KEY=your_key_here`
   - On Mac/Linux: `export GEMINI_API_KEY=your_key_here`
3. Run the script: `node generate_poem.js`
4. Open `index.htm` in your browser to view the results.

## Credits
- Books via [Project Gutenberg](https://www.gutenberg.org/) (catalog searched via [Gutendex](https://gutendex.com/)).
