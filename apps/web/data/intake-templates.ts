/**
 * Intake question templates for service/coaching businesses.
 * Used during onboarding (seller customizes) and by WhatsApp bot (guided flow).
 */

export interface IntakeQuestion {
  id: string;
  question: string;
  options: string[];
  allowFreeText?: boolean; // if true, customer can type instead of picking option
  sensitiveNote?: string; // shown before question for sensitive topics
}

export interface PackageTemplate {
  name: string;
  sessions: string;
  duration: string;
  includes: string[];
  priceRange: string;
  recommendFor?: string[]; // which intake answers map to this package
}

export interface IntakeTemplate {
  category: string;
  label: string;
  questions: IntakeQuestion[];
  packages: PackageTemplate[];
}

export const INTAKE_TEMPLATES: Record<string, IntakeTemplate> = {
  fitness: {
    category: 'fitness',
    label: 'Fitness Coaching',
    questions: [
      {
        id: 'goal',
        question: "What's your main fitness goal?",
        options: ['Weight loss / fat loss', 'Muscle building / toning', 'General fitness & stamina', 'Post-pregnancy recovery', 'Managing a health condition (diabetes, BP, thyroid)'],
      },
      {
        id: 'level',
        question: 'Have you trained before?',
        options: ['Complete beginner', 'On and off - not consistent', 'Used to train, stopped for a while', 'Currently active, want better results'],
      },
      {
        id: 'health',
        question: 'Any health concerns I should know about?',
        options: ['No health issues', 'Back pain / knee / joint problems', 'Diabetes / BP / thyroid', 'PCOD / hormonal issues', 'Recent surgery or pregnancy', "I'll share details later"],
      },
      {
        id: 'schedule',
        question: 'What works best for your schedule?',
        options: ['Morning (6-9 AM)', 'Afternoon (12-3 PM)', 'Evening (5-8 PM)', 'Flexible / weekends only'],
      },
    ],
    packages: [
      { name: 'Starter (1 Month)', sessions: '12 sessions', duration: '1 month', includes: ['Basic diet tips', 'WhatsApp support', 'Body assessment'], priceRange: '2,000 - 4,000', recommendFor: ['beginner', 'general fitness'] },
      { name: 'Transformation (3 Months)', sessions: '36 sessions', duration: '3 months', includes: ['Personalized diet plan', 'Weekly check-in', 'Progress photos', 'Body composition tracking'], priceRange: '5,000 - 10,000', recommendFor: ['weight loss', 'muscle building'] },
      { name: 'Premium PT (1 Month)', sessions: '20 sessions', duration: '1 month', includes: ['Custom meal plan', 'Daily WhatsApp guidance', 'Supplement advice', '1-on-1 personal training'], priceRange: '8,000 - 15,000' },
    ],
  },

  yoga: {
    category: 'yoga',
    label: 'Yoga',
    questions: [
      {
        id: 'goal',
        question: 'What brings you to yoga?',
        options: ['Stress relief & mental peace', 'Back pain / body pain / flexibility', 'Weight management', 'Pregnancy / post-natal wellness', 'Spiritual growth & meditation', 'General health & fitness'],
      },
      {
        id: 'level',
        question: 'Have you practiced yoga before?',
        options: ['Complete beginner', 'Tried a few times / YouTube', 'Practiced before, want to restart', 'Regular practitioner, want to go deeper'],
      },
      {
        id: 'health',
        question: 'Any physical conditions?',
        options: ['None - generally healthy', 'Back / neck / knee pain', 'BP / diabetes / thyroid', 'Pregnancy', 'Slip disc / sciatica', "I'll share details personally"],
      },
      {
        id: 'mode',
        question: 'Preferred mode?',
        options: ['Online (Zoom / Google Meet)', 'In-person at your studio', 'Home visit', "I'd like to know options first"],
      },
    ],
    packages: [
      { name: 'Foundation (1 Month)', sessions: '8 group sessions', duration: '1 month', includes: ['Basic asana practice', 'Breathing techniques', 'Batch of 5-8'], priceRange: '1,000 - 2,500' },
      { name: 'Therapeutic Yoga (1 Month)', sessions: '12 sessions (1:1)', duration: '1 month', includes: ['Customized for your condition', 'Progress tracking', 'Lifestyle guidance'], priceRange: '3,000 - 6,000' },
      { name: 'Advanced Practice (Monthly)', sessions: '16 sessions', duration: '1 month', includes: ['Pranayama + meditation + asana', 'Personal guidance', 'Flexible schedule'], priceRange: '4,000 - 8,000' },
    ],
  },

  coaching: {
    category: 'coaching',
    label: 'Tutoring / Academic Coaching',
    questions: [
      {
        id: 'subject',
        question: 'What does the student need help with?',
        options: ['School subjects (Maths, Science, English)', 'Board exam prep (10th / 12th)', 'Competitive exams (JEE, NEET, CUET)', 'Spoken English / communication', 'Coding / computer skills', 'Other skill or hobby'],
      },
      {
        id: 'class',
        question: 'Which class / standard?',
        options: ['Nursery - Class 5', 'Class 6-8', 'Class 9-10', 'Class 11-12', 'College / graduate', 'Working professional / adult'],
      },
      {
        id: 'board',
        question: 'Which board?',
        options: ['CBSE', 'ICSE / ISC', 'State board', 'IB / IGCSE', 'Not applicable'],
      },
      {
        id: 'format',
        question: 'Preferred class format?',
        options: ['1-on-1 (personal attention)', 'Small group (2-5 students)', 'Online classes', 'Home visit (tutor comes to us)'],
      },
    ],
    packages: [
      { name: 'Basic Tuition (Monthly)', sessions: '12 sessions (3/week)', duration: '1 month', includes: ['1 subject', 'Homework help', 'Test prep'], priceRange: '1,500 - 3,000' },
      { name: 'Board Exam Crash (3 Months)', sessions: '16 sessions/month', duration: '3 months', includes: ['2-3 subjects', 'Mock tests', 'Previous year papers', 'Doubt clearing'], priceRange: '4,000 - 8,000' },
      { name: 'All-Rounder (Monthly)', sessions: '16 sessions', duration: '1 month', includes: ['2 subjects', 'Parent updates', 'Progress reports', 'Extra exam-time sessions'], priceRange: '3,000 - 6,000' },
    ],
  },

  spiritual_healing: {
    category: 'spiritual_healing',
    label: 'Spiritual Healing',
    questions: [
      {
        id: 'goal',
        question: 'What are you looking for?',
        options: ['Stress / anxiety relief', 'Relationship / emotional healing', 'Career / financial clarity', 'Physical health support', 'Spiritual growth / self-discovery', "I'm curious, want to explore"],
      },
      {
        id: 'experience',
        question: 'Have you tried any healing modality before?',
        options: ['First time - completely new', 'Tried meditation / yoga', 'Had Reiki / energy healing before', 'Experienced with multiple modalities'],
      },
      {
        id: 'type',
        question: 'Which type of session interests you?',
        options: ['Reiki / energy healing', 'Tarot / oracle card reading', 'Numerology / astrology', 'Crystal healing', 'Past life regression', 'Not sure - guide me'],
      },
      {
        id: 'mode',
        question: 'Online or in-person?',
        options: ['Online (works from anywhere)', 'In-person', 'Whichever you recommend'],
      },
    ],
    packages: [
      { name: 'Discovery Session', sessions: '1 session (45-60 min)', duration: 'Single', includes: ['Assessment', 'Personalized guidance', 'Follow-up message'], priceRange: '500 - 1,500' },
      { name: 'Healing Journey (4 Sessions)', sessions: '4 sessions', duration: '4-6 weeks', includes: ['Combined modalities', 'WhatsApp support between sessions', 'Progress tracking'], priceRange: '2,500 - 5,000' },
      { name: 'Deep Transformation (8 Sessions)', sessions: '8 sessions', duration: '2-3 months', includes: ['Full healing protocol', 'Crystal/remedy recommendations', 'Ongoing support'], priceRange: '5,000 - 10,000' },
    ],
  },

  beauty: {
    category: 'beauty',
    label: 'Beauty / Salon Services',
    questions: [
      {
        id: 'service',
        question: 'What service are you looking for?',
        options: ['Regular salon (facial, waxing, threading)', 'Bridal / wedding makeup', 'Party / event makeup', 'Skin treatment (acne, pigmentation, tan)', 'Hair care (spa, keratin, color)', 'Mehendi / henna'],
      },
      {
        id: 'skin',
        question: 'Your skin type?',
        options: ['Normal', 'Oily / acne-prone', 'Dry / sensitive', 'Combination', 'Not sure'],
      },
      {
        id: 'products',
        question: 'Product preference?',
        options: ['Herbal / organic only', 'Branded (VLCC, Lotus, O3+)', 'No preference - you suggest', 'Sensitive skin, need hypoallergenic'],
      },
      {
        id: 'location',
        question: 'Where would you like the service?',
        options: ['At your parlour / studio', 'Home visit (at my place)', 'Want to know charges for both'],
      },
    ],
    packages: [
      { name: 'Essential Glow', sessions: '1 visit', duration: '2-3 hours', includes: ['Facial', 'Threading', 'Upper lip', 'Waxing (full arms + legs)'], priceRange: '800 - 1,500' },
      { name: 'Pre-Bridal (5 Sessions)', sessions: '5 sessions', duration: '1-2 months', includes: ['Deep cleansing', 'De-tan', 'Bleach', 'Hair spa', 'Trial makeup'], priceRange: '5,000 - 12,000' },
      { name: 'Bridal Day Package', sessions: '1 day', duration: 'Full day', includes: ['HD/airbrush makeup', 'Hairstyling', 'Draping', 'Touch-up kit'], priceRange: '8,000 - 25,000' },
    ],
  },

  stitching: {
    category: 'stitching',
    label: 'Stitching / Tailoring',
    questions: [
      {
        id: 'item',
        question: 'What would you like stitched?',
        options: ['Blouse', 'Kurti / kurta', 'Salwar suit (full set)', 'Lehenga / wedding outfit', 'Dress alteration / fitting', 'Other (saree fall, curtains, etc.)'],
      },
      {
        id: 'work',
        question: 'Type of work?',
        options: ['Simple / plain stitching', 'Designer cut / pattern', 'Heavy work (embroidery, beadwork)', 'Just alteration (resize/hem)'],
      },
      {
        id: 'timeline',
        question: 'When do you need it?',
        options: ['No rush - 7-10 days is fine', 'Within 4-5 days', 'Urgent - 2-3 days (rush charges apply)', 'For a specific date (wedding, event)'],
      },
      {
        id: 'measurements',
        question: 'Do you have measurements ready?',
        options: ["Yes, I'll share them", 'No, I need to get measured', 'I have a reference piece (old blouse/suit)', 'Can you do a home visit for measurements?'],
      },
    ],
    packages: [
      { name: 'Blouse Stitching', sessions: 'Per piece', duration: '5-7 days', includes: ['Custom fitting', 'Choice of neckline & sleeve style', '1 fitting session'], priceRange: '300 - 1,500' },
      { name: 'Suit Set (Kameez + Bottom)', sessions: 'Per set', duration: '7-10 days', includes: ['Full suit stitching', 'Lining included', '1 fitting session'], priceRange: '600 - 2,500' },
      { name: 'Bridal Package', sessions: 'Full outfit', duration: '15-20 days', includes: ['Lehenga + blouse + dupatta finishing', '2 fittings', 'Designer consultation', 'Heavy work support'], priceRange: '3,000 - 8,000' },
    ],
  },

  nutrition: {
    category: 'nutrition',
    label: 'Nutrition / Diet Consulting',
    questions: [
      {
        id: 'goal',
        question: "What's your primary health goal?",
        options: ['Weight loss', 'Weight gain / muscle building', 'PCOD / hormonal balance', 'Diabetes management', 'Pregnancy / post-natal nutrition', 'General healthy eating / immunity'],
      },
      {
        id: 'age',
        question: 'Your age group?',
        options: ['15-25 years', '25-35 years', '35-45 years', '45+ years'],
      },
      {
        id: 'body',
        question: 'Please share your approximate height (feet) and weight (kg):',
        options: [],
        allowFreeText: true,
      },
      {
        id: 'diet',
        question: 'Dietary preferences or restrictions?',
        options: ['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan', 'Jain (no onion/garlic)', 'No restrictions'],
      },
      {
        id: 'history',
        question: 'Have you tried dieting before?',
        options: ['No, first time', "Tried on my own but didn't work", "Followed a dietician's plan before", 'Currently on a plan, want a second opinion'],
      },
    ],
    packages: [
      { name: 'Quick Start (1 Month)', sessions: '4 follow-ups', duration: '1 month', includes: ['Initial assessment', 'Personalized meal plan', 'Weekly follow-up call', 'Grocery list'], priceRange: '1,500 - 3,000' },
      { name: 'Complete Transformation (3 Months)', sessions: 'Bi-weekly calls', duration: '3 months', includes: ['Detailed body analysis', 'Plan updated monthly', 'Recipe suggestions', 'Progress tracking'], priceRange: '4,000 - 8,000' },
      { name: 'Premium Coaching (Monthly)', sessions: 'Daily check-in', duration: '1 month', includes: ['Daily meal plan', 'Daily WhatsApp check-in', 'Blood report analysis', 'Restaurant/travel food guidance'], priceRange: '6,000 - 12,000' },
    ],
  },

  dance: {
    category: 'dance',
    label: 'Dance Classes',
    questions: [
      {
        id: 'style',
        question: 'What dance style interests you?',
        options: ['Bollywood / film dance', 'Classical (Bharatanatyam, Kathak, Odissi)', 'Western (Contemporary, Hip-hop, Jazz)', 'Zumba / dance fitness', 'Wedding choreography', 'Not sure - want to explore'],
      },
      {
        id: 'who',
        question: 'Who is this for?',
        options: ['Child (3-7 years)', 'Child (8-14 years)', 'Teenager (15-18)', 'Adult', 'Couple (wedding dance)', 'Group / batch'],
      },
      {
        id: 'level',
        question: 'Any prior dance experience?',
        options: ['Complete beginner', 'Learned a little as a kid', 'Intermediate - know basics', 'Advanced / performing level'],
      },
      {
        id: 'schedule',
        question: 'Preferred schedule?',
        options: ['Weekday morning', 'Weekday evening (after school/work)', 'Weekend only', 'Flexible - any slot'],
      },
    ],
    packages: [
      { name: 'Monthly Group (8 sessions)', sessions: '8 sessions', duration: '1 month', includes: ['2 sessions/week', 'Batch of 5-10', 'Monthly choreography'], priceRange: '800 - 2,000' },
      { name: 'Personal Training (8 sessions)', sessions: '8 sessions', duration: '1 month', includes: ['1-on-1 coaching', 'Custom choreography', 'Video recordings'], priceRange: '2,500 - 5,000' },
      { name: 'Wedding Choreography', sessions: '4-8 sessions', duration: '2-4 weeks', includes: ['Couple or sangeet group', 'Song selection help', 'Performance-ready'], priceRange: '5,000 - 15,000' },
    ],
  },

  music: {
    category: 'music',
    label: 'Music Classes',
    questions: [
      {
        id: 'instrument',
        question: 'What would you like to learn?',
        options: ['Singing / vocals', 'Guitar', 'Keyboard / piano', 'Tabla / percussion', 'Flute / other instrument', 'Music theory / composition'],
      },
      {
        id: 'style',
        question: 'Style preference?',
        options: ['Hindustani classical', 'Carnatic classical', 'Bollywood / film songs', 'Western (pop, rock, jazz)', 'Devotional / bhajans', 'Mix of everything'],
      },
      {
        id: 'level',
        question: 'Current level?',
        options: ['Absolute beginner', 'Self-taught / YouTube learner', 'Learned before, want to resume', 'Intermediate - want to improve', 'Advanced - grading/performance prep'],
      },
      {
        id: 'who',
        question: 'Who is this for?',
        options: ['Child (5-10 years)', 'Teenager (11-17)', 'Adult / working professional', 'Senior citizen'],
      },
    ],
    packages: [
      { name: 'Foundation (Monthly)', sessions: '8 sessions', duration: '1 month', includes: ['2 classes/week', 'Basics + practice guidance', 'Simple songs/pieces'], priceRange: '1,000 - 2,500' },
      { name: 'Performance (Monthly)', sessions: '12 sessions', duration: '1 month', includes: ['3 classes/week', 'Structured curriculum', 'Song repertoire building'], priceRange: '2,500 - 5,000' },
      { name: 'Crash Course (1-on-1)', sessions: '8 sessions', duration: '2-3 weeks', includes: ['Personal coaching', 'Song-of-choice', 'Fast-track for events'], priceRange: '3,000 - 6,000' },
    ],
  },

  counseling: {
    category: 'counseling',
    label: 'Counseling / Therapy',
    questions: [
      {
        id: 'concern',
        question: 'What brings you here today?',
        options: ['Stress / anxiety / overthinking', 'Relationship / family issues', 'Career confusion / work-life balance', 'Self-esteem / confidence', 'Grief / loss', "I'd prefer to share privately in session"],
        sensitiveNote: 'Thank you for reaching out. Everything you share is completely confidential.',
      },
      {
        id: 'history',
        question: 'Have you seen a counselor before?',
        options: ['No, this is my first time', 'Yes, but it was a while ago', 'Currently seeing someone, want a different perspective'],
      },
      {
        id: 'mode',
        question: 'Preference for session format?',
        options: ['Video call (online)', 'In-person', 'Phone call', "I'd like your recommendation"],
      },
    ],
    packages: [
      { name: 'Single Session (50 min)', sessions: '1 session', duration: '50 minutes', includes: ['Initial consultation', 'Assessment', 'Coping strategies', 'Follow-up notes via WhatsApp'], priceRange: '800 - 2,000' },
      { name: '4-Session Package', sessions: '4 sessions', duration: '1 month', includes: ['Weekly sessions', 'Structured approach', 'Between-session support', 'Journaling prompts'], priceRange: '2,800 - 7,000' },
      { name: '12-Session Journey', sessions: '12 sessions', duration: '3 months', includes: ['Deep work', 'Flexible scheduling', 'Crisis support'], priceRange: '7,500 - 18,000' },
    ],
  },

  language: {
    category: 'language',
    label: 'Language Tutoring',
    questions: [
      {
        id: 'language',
        question: 'Which language do you want to learn?',
        options: ['English (spoken / written / both)', 'Hindi', 'French / German / Spanish', 'Japanese / Korean / Mandarin', 'Sanskrit / regional Indian language', 'Other'],
      },
      {
        id: 'purpose',
        question: 'Why are you learning?',
        options: ['Improve spoken fluency / confidence', 'Job / interview preparation', 'School / college exam', 'Moving abroad / visa (IELTS, TOEFL)', 'Personal interest / hobby', 'For my child'],
      },
      {
        id: 'level',
        question: 'Current level?',
        options: ['Zero knowledge - starting from scratch', "Can understand but can't speak well", 'Basic - know common phrases', 'Intermediate - can hold a conversation', 'Advanced - want to polish'],
      },
      {
        id: 'format',
        question: 'Preferred batch size?',
        options: ['1-on-1 (personal coaching)', 'Small group (3-5 people)', 'Batch class (more affordable)', 'Self-paced with mentor support'],
      },
    ],
    packages: [
      { name: 'Conversation Course (1 Month)', sessions: '12 sessions', duration: '1 month', includes: ['Speaking + listening focus', 'Real-life practice scenarios', 'Weekly assignments'], priceRange: '2,000 - 4,000' },
      { name: 'Exam Prep (IELTS/TOEFL)', sessions: '20 sessions', duration: '6-8 weeks', includes: ['Mock tests', 'Band/score prediction', 'Material provided'], priceRange: '5,000 - 10,000' },
      { name: 'Kids Language (Monthly)', sessions: '8 sessions', duration: '1 month', includes: ['Story/game-based learning', 'Age-appropriate content', 'Progress report to parents'], priceRange: '1,200 - 2,500' },
    ],
  },

  art: {
    category: 'art',
    label: 'Art & Craft Classes',
    questions: [
      {
        id: 'type',
        question: 'What are you interested in?',
        options: ['Drawing & sketching', 'Painting (watercolor, acrylic, oil)', 'Mandala / Warli / folk art', 'Calligraphy / lettering', 'Crafts (clay, resin, paper, fabric)', 'Mixed media / exploring everything'],
      },
      {
        id: 'who',
        question: 'Who is this for?',
        options: ['Child (4-7 years)', 'Child (8-12 years)', 'Teenager (13-17)', 'Adult hobbyist', 'Adult - want to go professional'],
      },
      {
        id: 'level',
        question: 'Any art experience?',
        options: ['None - complete beginner', 'Did art in school, want to restart', 'Self-taught, want to improve', 'Have formal training, want advanced'],
      },
      {
        id: 'format',
        question: 'Preferred format?',
        options: ['Online live classes', 'Offline (at your studio)', 'Weekend workshops', 'Self-paced recorded course'],
      },
    ],
    packages: [
      { name: 'Monthly Batch (8 sessions)', sessions: '8 sessions', duration: '1 month', includes: ['2 sessions/week', 'Materials list provided', 'Project-based learning', 'Certificate'], priceRange: '800 - 2,000' },
      { name: 'Weekend Workshop', sessions: '1 session', duration: '2-3 hours', includes: ['Complete one project', 'All materials provided', 'Take home your artwork'], priceRange: '500 - 1,500' },
      { name: 'Personal Coaching (Monthly)', sessions: '8-12 sessions', duration: '1 month', includes: ['1-on-1', 'Custom curriculum', 'Portfolio development', 'Mentorship'], priceRange: '2,500 - 5,000' },
    ],
  },
};

// Helper: get template for a seller's category
export function getIntakeTemplate(category: string): IntakeTemplate | null {
  const key = category.toLowerCase().replace(/[\s\/&]+/g, '_');
  return INTAKE_TEMPLATES[key] || null;
}

// All service categories that should use intake flow
export const SERVICE_CATEGORIES = Object.keys(INTAKE_TEMPLATES);
