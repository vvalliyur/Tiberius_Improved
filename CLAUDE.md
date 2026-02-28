# CLAUDE.md — Project Instructions

## Frontend Design Rules

### 1. Always Use the Frontend-Design Skill
When making ANY frontend/UI change, you MUST invoke the `frontend-design` skill FIRST before writing code. This ensures every component gets professional design treatment — never skip it.

### 2. Visual Verification with Puppeteer
After making frontend changes, use Puppeteer to screenshot the result and review it visually before considering the task done.

- The dev server runs at `http://localhost:3000`
- Take screenshots with: `node -e "const p=require('puppeteer');(async()=>{const b=await p.launch();const pg=await b.newPage();await pg.setViewport({width:1440,height:900});await pg.goto('http://localhost:3000',{waitUntil:'networkidle0'});await pg.screenshot({path:'/tmp/screenshot.png',fullPage:true});await b.close()})()"`
- Read the screenshot image to evaluate the visual output
- If the design looks off, iterate until it meets the quality bar below
- Take mobile screenshots too (viewport 390x844) when touching responsive layouts

### 3. Design Quality Bar — No Generic AI Aesthetic
The UI must feel hand-crafted by a senior product designer. Follow these principles:

- **No default/stock look**: Never use unstyled HTML elements, default browser buttons, or basic form inputs. Every element must be intentionally designed.
- **Modern patterns**: Use layered shadows, subtle gradients, micro-interactions, smooth transitions, glassmorphism where appropriate, and thoughtful spacing.
- **Typography matters**: Use font-weight variation, letter-spacing, and size hierarchy to create visual rhythm. Avoid uniform text walls.
- **Color with purpose**: Use color to guide attention, indicate state, and create depth — not just decoration. Follow the established design token system in `index.css`.
- **Whitespace is a feature**: Generous padding, clear content grouping, breathing room between sections.
- **Polish details**: Hover states, focus rings, loading skeletons, empty states, smooth page transitions. The small things signal quality.
- **Avoid AI tells**: No excessive gradients-on-everything, no over-rounded corners on every element, no generic hero sections with gradient text. Design should feel opinionated and specific to this product — a poker accounting platform, not a SaaS landing page.
