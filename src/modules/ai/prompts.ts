
// Common Response Formats
export const array_of_strings = { "type": "array", "items": { "type": "string" } };
/**
 * Response schema to represent array of strings `["string1", "string2"]`
 */

// Extract Skills
export const extract_skills_prompt = `
You are a job requirements extractor and classifier. Your task is to extract all skills mentioned in a job description and classify them into five categories:
1. "tech_stack": Identify all skills related to programming languages, frameworks, libraries, databases, and other technologies used in software development. Examples include Python, React.js, Node.js, Elasticsearch, Algolia, MongoDB, Spring Boot, .NET, etc.
2. "technical_skills": Capture skills related to technical expertise beyond specific tools, such as architectural design or specialized fields within engineering. Examples include System Architecture, Data Engineering, System Design, Microservices, Distributed Systems, etc.
3. "other_skills": Include non-technical skills like interpersonal, leadership, and teamwork abilities. Examples include Communication skills, Managerial roles, Cross-team collaboration, etc.
4. "required_skills": All skills specifically listed as required or expected from an ideal candidate. Include both technical and non-technical skills.
5. "nice_to_have": Any skills or qualifications listed as preferred or beneficial for the role but not mandatory.
Return the output in the following JSON format with no additional commentary:
{{
    "tech_stack": [],
    "technical_skills": [],
    "other_skills": [],
    "required_skills": [],
    "nice_to_have": []
}}

JOB DESCRIPTION:
{}
`;
/**
 * Use \`extract_skills_prompt.replace('{}', job_description)\` to insert \`job_description\`.
 */

// DeepSeek-specific optimized prompt
export const deepseek_extract_skills_prompt = `
You are a job requirements extractor and classifier. Your task is to extract all skills mentioned in a job description and classify them into five categories:
1. "tech_stack": Identify all skills related to programming languages, frameworks, libraries, databases, and other technologies used in software development. Examples include Python, React.js, Node.js, Elasticsearch, Algolia, MongoDB, Spring Boot, .NET, etc.
2. "technical_skills": Capture skills related to technical expertise beyond specific tools, such as architectural design or specialized fields within engineering. Examples include System Architecture, Data Engineering, System Design, Microservices, Distributed Systems, etc.
3. "other_skills": Include non-technical skills like interpersonal, leadership, and teamwork abilities. Examples include Communication skills, Managerial roles, Cross-team collaboration, etc.
4. "required_skills": All skills specifically listed as required or expected from an ideal candidate. Include both technical and non-technical skills.
5. "nice_to_have": Any skills or qualifications listed as preferred or beneficial for the role but not mandatory.

IMPORTANT: You must ONLY return valid JSON object in the exact format shown below - no additional text, explanations, or commentary.
Each category should contain an array of strings, even if empty.

{{
    "tech_stack": ["Example Skill 1", "Example Skill 2"],
    "technical_skills": ["Example Skill 1", "Example Skill 2"],
    "other_skills": ["Example Skill 1", "Example Skill 2"],
    "required_skills": ["Example Skill 1", "Example Skill 2"],
    "nice_to_have": ["Example Skill 1", "Example Skill 2"]
}}

JOB DESCRIPTION:
{}
`;
/**
 * DeepSeek optimized version, use \`deepseek_extract_skills_prompt.replace('{}', job_description)\` to insert \`job_description\`.
 */

export const extract_skills_response_format = {
  "type": "json_schema",
  "json_schema": {
    "name": "Skills_Extraction_Response",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "tech_stack": array_of_strings,
        "technical_skills": array_of_strings,
        "other_skills": array_of_strings,
        "required_skills": array_of_strings,
        "nice_to_have": array_of_strings,
      },
      "required": [
        "tech_stack",
        "technical_skills",
        "other_skills",
        "required_skills",
        "nice_to_have",
      ],
      "additionalProperties": false
    },
  },
};
/**
 * Response schema for \`extract_skills\` function
 */

// Answer Questions
export const ai_answer_prompt = `
You are filling out a job application form on behalf of the user. Answer as the user would, in first person.
Respond concisely based on the type of question:

1. If the question asks for **years of experience, duration, or a numeric value**, return **only a number** (e.g., "2", "5", "10").
2. If the question is **a Yes/No question**, return **only "Yes" or "No"**.
3. If OPTIONS are given, return **exactly one option's text, copied verbatim**, and nothing else.
4. If the question requires a **short description**, give a **single-sentence response**.
5. If the question requires a **detailed response**, give a well-structured, human-like answer **under 350 characters**.
6. Do **not** repeat the question, explain your reasoning, or mention that you are an AI.
7. Base answers on the user information below. If it doesn't cover the question, give the most reasonable answer consistent with it.

**User Information:**
{}

**Question:**
{}
`;
