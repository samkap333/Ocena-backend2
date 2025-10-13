// config/knowledgeBase.js - Ocena Company Knowledge Base

const COMPANY_KNOWLEDGE = `
OCENA SMART SOLUTIONS - COMPANY INFORMATION

ABOUT OCENA:
Ocena Smart Solutions powers the future with cutting-edge Blockchain, AI, and Full Stack solutions that drive growth, transparency, and scalability.

Our Core Principles:
- Innovation: Bold ideas, fearless execution, shaping tomorrow's technology today.
- Quality: Flawless code, seamless experiences, uncompromising standards.
- Client-Centricity: Your success is our mission; we build solutions around you.
Website: https://ocena.in/about

SERVICES WE OFFER:
1. Web & App Development - High-performance websites and mobile apps for maximum engagement.
2. AI Agents - Custom AI agents to automate tasks and boost efficiency.
3. Smart Contracts - Immutable, self-executing contracts for secure automation.
4. Decentralized Applications (dApps) - Resilient apps giving users full control and ownership.
5. Token Development - Secure creation of utility, governance, or NFT tokens.
6. Wallet Development - Safe and seamless digital wallet solutions.
7. DeFi Solutions - Innovative decentralized finance protocols for lending and staking.
8. NFT Marketplace - Custom marketplaces for secure and scalable NFT trading.
9. Metaverse Development - Immersive virtual worlds and interactive digital experiences.
10. Game Development - Engaging Play-to-Earn games with blockchain integration.
More details: https://ocena.in/services

PROJECTS WE'VE COMPLETED:
1. TOBO - Restaurant Billing Software: Streamlined billing, cut processing time by 40%, improved order accuracy.
2. NIKU NERURO - Boosted emotional stability by 45% within two weeks.
3. THAI COIN - Launched on Polygon with fast trading and support for 100+ wallets.
4. UNIPORTAL INDIA - Automated application management, increased efficiency by 60%, handling 10k+ applications.
5. BULK OFFER LETTER GENERATOR - Generates thousands of letters in seconds, saving 40% time and reducing errors.
6. DRAGONVALE - Enhanced gaming experience by optimizing backend and increasing animation speed.
7. AI TWITTER BOT - Schedules and posts tweets automatically, saving 50% time and optimizing strategy.
8. JewelryERP - Bilingual ERP used by 100+ stores, simplifying operations and scaling efficiently.
9. OC Wallet - Cross-chain decentralized wallet for secure crypto swapping, buying, and selling.
10. Crypto Price Alert using N8N - Sends instant cryptocurrency alerts via Telegram & WhatsApp for timely action.
View portfolio: https://ocena.in/portfolio

COURSES AVAILABLE:
1. Frontend Development Mastery - $499 | 3 Months
   - Build fast, responsive UIs with React, Next.js, Vue
   - Advanced CSS/SCSS/Tailwind techniques
   - 5 portfolio-ready projects
   - Career Advantage: Job-ready, interview prep, scalable frontend skills

2. Backend Engineering Professional - $599 | 3.5 Months
   - Node.js/Express or Python/Django
   - Databases: PostgreSQL/MongoDB
   - Authentication & Security (JWT, OAuth)
   - Cloud deployment on AWS/Azure/GCP
   - Career Advantage: Deploy microservices, API & system architecture expertise

3. Full Stack Development Accelerator - $899 | 5 Months
   - Combines Frontend + Backend modules
   - Capstone project coaching & CI/CD tools
   - Interview prep & resume review
   - Career Advantage: 1:1 mentorship, launch SaaS clone, manage full software lifecycle

4. Blockchain & Web3 Engineering - $799 | 4 Months
   - Solidity & smart contract development
   - Ethereum/EVM architecture & DApps with Ethers.js/Web3.js
   - Security auditing & token standards (ERC-20, ERC-721)
   - Career Advantage: Build NFT marketplaces, access Web3 hiring network
All courses: https://ocena.in/courses

CONTACT INFORMATION:
- Email: business@ocena.in
- WhatsApp: +91-7652992906
- Contact page: https://ocena.in/contact

BOOKING & FORMS:
- Schedule a meeting: https://calendar.app.google/pw23w5zRT3ar3JKbA
- Submit project details: https://forms.gle/y61TegNfj2Tk3LyD9

IMPORTANT INSTRUCTIONS FOR AI:
When user asks to schedule/book a meeting, provide this link: https://calendar.app.google/pw23w5zRT3ar3JKbA
When user wants to share project details, provide this link: https://forms.gle/y61TegNfj2Tk3LyD9
When user asks for contact, provide: Email: business@ocena.in, WhatsApp: +91-7652992906
`;

// Helper function to extract relevant context based on user query
function getRelevantContext(userMessage, knowledgeBase = COMPANY_KNOWLEDGE) {
  const message = userMessage.toLowerCase();
  
  // Check for specific intents
  if (message.includes('meeting') || message.includes('schedule') || message.includes('book') || message.includes('appointment')) {
    return knowledgeBase.split('BOOKING & FORMS:').pop();
  }
  
  if (message.includes('project detail') || message.includes('submit') || message.includes('form') || message.includes('share detail')) {
    return knowledgeBase.split('BOOKING & FORMS:').pop();
  }
  
  if (message.includes('contact') || message.includes('email') || message.includes('phone') || message.includes('whatsapp')) {
    return knowledgeBase.match(/CONTACT INFORMATION:[\s\S]*?(?=BOOKING|$)/)?.[0] || knowledgeBase;
  }
  
  if (message.includes('service') || message.includes('what do you do') || message.includes('offer')) {
    return knowledgeBase.match(/SERVICES WE OFFER:[\s\S]*?(?=PROJECTS|$)/)?.[0] || knowledgeBase;
  }
  
  if (message.includes('project') || message.includes('portfolio') || message.includes('work done')) {
    return knowledgeBase.match(/PROJECTS WE'VE COMPLETED:[\s\S]*?(?=COURSES|$)/)?.[0] || knowledgeBase;
  }
  
  if (message.includes('course') || message.includes('training') || message.includes('learn')) {
    return knowledgeBase.match(/COURSES AVAILABLE:[\s\S]*?(?=CONTACT|$)/)?.[0] || knowledgeBase;
  }
  
  if (message.includes('about') || message.includes('who are you') || message.includes('company')) {
    return knowledgeBase.match(/ABOUT OCENA:[\s\S]*?(?=SERVICES|$)/)?.[0] || knowledgeBase;
  }
  
  // Default: return full knowledge base
  return knowledgeBase;
}

// Helper function to check if query is relevant to company
function isRelevantQuery(userMessage) {
  const relevantKeywords = [
    // Company
    'ocena', 'company', 'about', 'who are you', 'what do you do',
    
    // Services
    'service', 'services', 'offer', 'provide', 'web development', 'app development',
    'blockchain', 'ai agent', 'smart contract', 'dapp', 'token', 'wallet', 
    'defi', 'nft', 'metaverse', 'game', 'development',
    
    // Projects
    'project', 'portfolio', 'work', 'built', 'created', 'tobo', 'niku', 'thai coin',
    'uniportal', 'jewelryerp', 'oc wallet', 'dragonvale',
    
    // Courses
    'course', 'courses', 'training', 'learn', 'teach', 'frontend', 'backend',
    'full stack', 'web3', 'blockchain course', 'bootcamp', 'program',
    
    // Business
    'price', 'pricing', 'cost', 'how much', 'payment', 'hire', 'quote',
    'consultation', 'meeting', 'schedule', 'book', 'appointment',
    
    // Contact
    'contact', 'email', 'phone', 'whatsapp', 'reach', 'talk', 'connect',
    'project details', 'form', 'submit',
    
    // Questions
    'how', 'what', 'when', 'where', 'can you', 'do you', 'help'
  ];

  const message = userMessage.toLowerCase();
  return relevantKeywords.some(keyword => message.includes(keyword));
}

module.exports = {
  COMPANY_KNOWLEDGE,
  getRelevantContext,
  isRelevantQuery
};