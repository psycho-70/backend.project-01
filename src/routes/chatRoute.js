import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Your personal information from CV (structured for easy reference)
const personalInfo = {
  name: "Furqan Ullah",
  contact: {
    phone: "+923141868872",
    email: "furqankhan.webdev@gmail.com",
    linkedin: "https://www.linkedin.com/in/furqan-khan-162170176",
    location: "Bahria town civic center Rawalpindi phase 4"
  },
  title: "Front-End Developer",
  skills: ["React.js", "Next.js", "Node.js", "Tailwind CSS", "TypeScript"],
  experience: [
    {
      company: "Precise Tech - Canada",
      position: "Web Developer (Remote)",
      duration: "08/2024 - Present",
      responsibilities: [
        "Work remotely on enterprise resource planning (ERP) solutions using Jira, Typescript, and TFS",
        "Contributed to specialized websites like Nature Clam and Sowa Tooling",
        "Collaborate with cross-functional teams to design and implement features",
        "Participate in code reviews and agile development processes"
      ]
    },
    {
      company: "Uzair Technology (Kohat)",
      position: "Intern (React.js and Web Development)",
      duration: "06/2023 - 12/2023",
      responsibilities: [
        "Built web applications including Weather App, Profile App, To-Do List App",
        "Gained experience in React and Tailwind CSS"
      ]
    },
    {
      company: "Khushal Institute - Karak",
      position: "Web Development Instructor & Computer Education Teacher",
      duration: "01/2024 - 06/2024",
      responsibilities: [
        "Instructed students in HTML, CSS, JavaScript, and modern web frameworks",
        "Taught office automation, networking, and basic computer skills"
      ]
    }
  ],
  education: {
    institution: "Kohat University of Science and Technology",
    degree: "BS Software Engineering",
    graduation: "June 2023"
  },
  projects: [
    {
      name: "TODO - List",
      technologies: ["React", "Tailwind CSS", "Local Storage"],
      link: "https://todo-delta-ten-73.vercel.app/"
    },
    {
      name: "WeatherAPP",
      technologies: ["React.js", "Node.js", "Express.js", "Tailwind CSS", "Material UI", "Firebase"],
      link: "https://weatherapp-lilac-xi.vercel.app/"
    },
    {
      name: "Sowa Tooling (Canada)",
      technologies: ["Next.js", "Tailwind CSS", "TypeScript", ".NET", "SQL"],
      link: "https://www.sowatool.com/"
    },
    {
      name: "NaturalCalm (Canada)",
      technologies: ["HTML5", "CSS3", "JavaScript"],
      link: "https://naturalcalm.ca/"
    }
  ],
  awards: [
    "KUST IT Department Award (2023)",
    "Awarded for introducing the FCP Plan during Final Year Project"
  ]
};

// System prompt that will guide Gemini's responses
const SYSTEM_PROMPT = `
You are Furqan Ullah's portfolio assistant chatbot. Your purpose is to provide information about Furqan's professional background, skills, and projects.

Guidelines:
1. Always respond in a professional yet friendly tone
2. Keep responses concise but informative
3. Structure information clearly when listing items
4. Always verify information from the provided data before responding
5. For project inquiries, include the technologies used and links when available
6. For work experience questions, include duration and key responsibilities

Personal Information:
${JSON.stringify(personalInfo, null, 2)}

Example Responses:
- "Furqan has 1.5+ years of experience in web development with expertise in React.js, Next.js, and Tailwind CSS."
- "He currently works at Precise Tech Canada as a Remote Web Developer since August 2024."
- "His project WeatherAPP was built with React.js, Node.js, and Firebase. Check it out at [link]"
`;

router.post('/', async (req, res) => {
  try {
    const { currentInput } = req.body;

    if (!currentInput || typeof currentInput !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid message format',
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Combine system prompt with user input
    const fullPrompt = `${SYSTEM_PROMPT}\n\nUser Question: ${currentInput}\n\nAssistant Response:`;
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      response: text,
    });

  } catch (error) {
    console.error('Gemini Server Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;