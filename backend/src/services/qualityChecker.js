/**
 * Automated Quality Checker Service
 * Evaluates job postings for scams, missing info, and spam patterns.
 * Never auto-removes; routes flags to human review queue.
 */

export async function checkOpportunityQuality({ title, description, payAmountMin, payAmountMax, payPeriod, skills = [] }) {
  const combinedText = `${title} ${description} ${payAmountMin || ''} ${payAmountMax || ''} ${payPeriod || ''}`.toLowerCase();

  const scamTriggers = [
    'pay upfront',
    'application fee',
    'registration fee',
    'send money',
    'airtime deposit',
    'whatsapp money',
    'guaranteed 100k daily',
    'quick cash no work',
    'wire transfer'
  ];

  const spamTriggers = [
    'test job',
    'asdf',
    'click here now',
    'cheap loans',
    'make money fast'
  ];

  let flagged = false;
  let reasons = [];

  // Check 1: Scam patterns
  for (const trigger of scamTriggers) {
    if (combinedText.includes(trigger)) {
      flagged = true;
      reasons.push(`Potential scam pattern detected: "${trigger}". Upfront payment demands are prohibited.`);
    }
  }

  // Check 2: Spam / Vague content
  for (const trigger of spamTriggers) {
    if (combinedText.includes(trigger)) {
      flagged = true;
      reasons.push(`Low quality / spam content detected: "${trigger}".`);
    }
  }

  // Check 3: Short or insufficient description
  if (description.trim().length < 20) {
    flagged = true;
    reasons.push('Job description is too brief (minimum 20 characters required).');
  }

  // Check 4: Unrealistic pay rate check
  if (payAmountMin && Number(payAmountMin) > 50000000 && payPeriod === 'hourly') {
    flagged = true;
    reasons.push('Unrealistic pay rate specified.');
  }

  // Check 5: If Gemini API key is configured, perform LLM evaluation
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const prompt = `Analyze this job posting in Malawi for potential fraud, scams, or missing info:
Title: ${title}
Description: ${description}
Pay: ${payAmountMin || 'N/A'} - ${payAmountMax || 'N/A'} (${payPeriod || 'N/A'})
Required Skills: ${skills.join(', ')}

Respond ONLY with valid JSON in this exact structure:
{"isFlagged": boolean, "reason": "string describing issue or empty"}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJsonStr = rawText.replace(/```json|```/g, '').trim();
        const llmResult = JSON.parse(cleanJsonStr);

        if (llmResult.isFlagged && llmResult.reason) {
          flagged = true;
          reasons.push(`[AI Checker]: ${llmResult.reason}`);
        }
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to heuristic quality check:', err.message);
    }
  }

  return {
    passed: !flagged,
    status: flagged ? 'flagged' : 'published',
    reason: reasons.length > 0 ? reasons.join(' ') : null
  };
}

export default checkOpportunityQuality;
