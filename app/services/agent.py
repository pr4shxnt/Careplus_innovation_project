import requests
import json
import re
from .llm import llm_service
from .rag import rag_service
from .router import router_service

BUN_API_URL = "http://localhost:3000/api"

class SwasthaAgent:
    def __init__(self):
        # --- System Prompts (Multi-Language Intelligence) ---
        self.PROMPT_QA_NE = (
            "तपाईं एक नेपाली स्वास्थ्य सहायक हुनुहुन्छ।\n"
            "नियम: केवल शुद्ध नेपाली भाषा (देवनागरी लिपि) मा जवाफ दिनुहोस्।\n"
            "कुनै पनि अंग्रेजी शब्द (English), रोमन नेपाली (Romanized), वा अनावश्यक भूमिका नथप्नुहोस्।\n"
            "केभल सन्दर्भबाट प्रश्नको सिधा जवाफ मात्र दिनुहोस्।"
        )
        self.PROMPT_GENERAL_NE = (
            "तपाईं 'स्वस्थ साथी' (Swastha Sathi) हुनुहुन्छ — एक मैत्रीपूर्ण नेपाली स्वास्थ्य सहायक।\n"
            "नियमहरू:\n"
            "१. केवल नेपाली देवनागरी लिपिमा जवाफ दिनुहोस्।\n"
            "२. छोटो, स्पष्ट र सहयोगी बन्नुहोस्।\n"
            "३. चिकित्सा प्रश्नहरूको लागि RAG सन्दर्भ प्रयोग गरिन्छ, तर यहाँ तपाईं सामान्य कुराकानी र स्वागत (greeting) को लागि हुनुहुन्छ।"
        )
        
        self.PROMPT_QA_EN = "You are a health assistant. Reply only in English. No Nepali or Romanized Nepali. Answer only from provided context. Add medical disclaimer at the end."
        self.PROMPT_GENERAL_EN = (
            "You are Swastha Sathi, a friendly assistant.\n"
            "Strict rules:\n"
            "1. Reply ONLY in plain English. No Nepali, no Romanized Nepali.\n"
            "2. Never add translations or transliterations.\n"
            "3. Never assume the user is sick unless explicitly stated.\n"
            "Example:\n"
            "User: I am fine\n"
            "Assistant: Great to hear! How can I help you today?"
        )

    def is_confirmation(self, text):
        prompt = f"के प्रयोगकर्ताले पुष्टि गर्दैछन् वा 'हुन्छ' भन्दैछन्? पाठ: \"{text}\"। केवल 'yes' वा 'no' मा जवाफ दिनुहोस्।"
        resp = llm_service.generate_response(prompt).strip().lower()
        return "yes" in resp

    def is_rejection(self, text):
        prompt = f"के प्रयोगकर्ताले अस्वीकार गर्दैछन् वा 'हुँदैन' भन्दैछन्? पाठ: \"{text}\"। केवल 'yes' वा 'no' मा जवाफ दिनुहोस्।"
        resp = llm_service.generate_response(prompt).strip().lower()
        return "yes" in resp

    def run_chat(self, user_id, message, history=None):
        lang = llm_service.detect_language(message)
        
        # 1. Intent Classification (The "Brain")
        intent = router_service.classify(message)
        
        # 2. Process Intents
        
        # --- MEDICINE QUERY ---
        if intent == "MEDICINE_QUERY":
            try:
                resp = requests.get(f"{BUN_API_URL}/medicines/user/{user_id}")
                meds = resp.json() if resp.status_code == 200 else []
                if meds:
                    if lang == "ne":
                        res = "यहाँ तपाईंका औषधिहरू छन्:\n" + "\n".join([f"- **{m['name']}** ({m['dosage']}) - {', '.join([s['time'] for s in m['schedule']])}" for m in meds])
                    else:
                        res = "Here are your medicines:\n" + "\n".join([f"- **{m['name']}** ({m['dosage']}) - {', '.join([s['time'] for s in m['schedule']])}" for m in meds])
                    return res
                return "तपाईंले अहिलेसम्म कुनै औषधि थप्नुभएको छैन।" if lang == "ne" else "You haven't added any medicines yet."
            except:
                return "Connecting to health records failed."

        # --- HEALTH QA (RAG System) ---
        elif intent == "HEALTH_QA":
            relevant_chunks = rag_service.retrieve(message)
            if not relevant_chunks:
                return (
                    "मसँग मेरो ज्ञानकोषमा त्यसको बारेमा कुनै विशिष्ट जानकारी छैन। कृपया स्वास्थ्य पेशेवरसँग परामर्श लिनुहोस्।"
                    if lang == "ne" else
                    "I don't have specific information about that. Please consult a professional."
                )
            
            # Combine chunks and filter out the 'Question' lines to ensure direct answers
            raw_context = "\n\n".join([c["content"] for c in relevant_chunks])
            context_lines = [line.strip() for line in raw_context.split('\n') if not line.strip().startswith('प्र:')]
            context = "\n".join(context_lines)
            system_prompt = self.PROMPT_QA_NE if lang == "ne" else self.PROMPT_QA_EN
            prompt = f"{context}\n\n{message}"
            
            # For Health QA, we discard history to avoid being biased by past hallucinations
            chat_messages = [{"role": "user", "content": prompt}]
            return llm_service.chat(chat_messages, system_prompt=system_prompt)

        # --- OBJECT QUERY ---
        elif intent == "OBJECT_QUERY":
            obj_name_prompt = (
                f"Identify the object name from this question: \"{message}\".\n\n"
                f"Examples:\n"
                f"- 'Where are my keys?': keys\n"
                f"- 'kaha xa mero spectacles?': spectacles\n"
                f"- 'find my wallet': wallet\n\n"
                f"Reply ONLY with the object name. No other text."
            )
            obj_name_raw = llm_service.generate_response(obj_name_prompt).strip().lower()
            
            # Sanitization: Extract only the object name if the LLM rambled
            # Remove common prefixes/suffixes
            obj_name = obj_name_raw.split('\n')[0].split(':')[-1].strip().rstrip('.')
            
            # Special case: General queries for "things", "items", "সামान"
            general_keywords = ["things", "items", "objects", "everything", "all", "samaaan", "saman", "सामान", "सबै", "थोक"]
            if any(kw in obj_name for kw in general_keywords) or any(kw in message.lower() for kw in general_keywords):
                try:
                    resp = requests.get(f"{BUN_API_URL}/objects/user/{user_id}")
                    if resp.status_code == 200:
                        all_objs = resp.json()
                        if all_objs:
                            objs_str = "\n".join([f"- **{o['name']}**: {o['location']} ({o['time']})" for o in all_objs])
                            if lang == "ne":
                                return "यहाँ तपाईंका सामानहरू र तिनका स्थानहरू छन्:\n" + objs_str
                            else:
                                return "Here are your items and their locations:\n" + objs_str
                        return "तपाईंले अहिलेसम्म कुनै सामान रेकर्ड गर्नुभएको छैन।" if lang == "ne" else "You haven't recorded any items yet."
                except: pass

            if "not specified" in obj_name or "unknown" in obj_name or len(obj_name) > 30:
                # Fallback: very simple keyword extraction if LLM fails
                words = re.findall(r'\b\w+\b', message.lower())
                # Exclude common query words (EN and NE)
                stop_words = [
                    "where", "are", "my", "is", "find", "the", "kaha", "khoi", "kata", "mero",
                    "कहाँ", "खोई", "कता", "मेरो", "छ", "छन्", "हो", "होइन", "भन्दिन", "सक्नुहुन्छ"
                ]
                filtered = [w for w in words if w not in stop_words]
                obj_name = filtered[-1] if filtered else "object"
            
            try:
                # Searching the Bun database for the recorded location
                resp = requests.get(f"{BUN_API_URL}/objects?userId={user_id}&name={obj_name}")
                if resp.status_code == 200:
                    data = resp.json()
                    loc = data.get("location", "unknown")
                    time = data.get("time", "recently")
                    if lang == "ne":
                        return f"भेटियो: तपाईंको **{obj_name}** **{loc}** मा छ ({time} मा रेकर्ड गरिएको)।"
                    else:
                        return f"Found it: Your **{obj_name}** is at **{loc}** (recorded on {time})."
            except: pass
            
            return f"माफ गर्नुहोस्, मसँग तपाईंको {obj_name} को कुनै रेकर्ड छैन।" if lang == "ne" else f"I don't have a record of your {obj_name}."

        # --- OBJECT SAVE ---
        elif intent == "OBJECT_SAVE":
            # Extract object name and location from the message
            extract_prompt = (
                f"From this message, extract the object name and its location.\n"
                f"Message: \"{message}\"\n\n"
                f"Examples:\n"
                f"- 'I kept my glasses on the table': OBJECT: glasses, LOCATION: table\n"
                f"- 'placed keys in the drawer': OBJECT: keys, LOCATION: drawer\n\n"
                f"Reply in EXACTLY this format:\n"
                f"OBJECT: <object name>\n"
                f"LOCATION: <location>\n"
                f"Nothing else."
            )
            extraction = llm_service.generate_response(extract_prompt).strip()
            
            obj_name = ""
            obj_location = ""
            for line in extraction.split("\n"):
                line = line.strip()
                if line.upper().startswith("OBJECT:"):
                    obj_name = line.split(":", 1)[1].strip()
                elif line.upper().startswith("LOCATION:"):
                    obj_location = line.split(":", 1)[1].strip()
            
            if not obj_name or not obj_location:
                if lang == "ne":
                    return "माफ गर्नुहोस्, म वस्तुको नाम वा स्थान बुझ्न सकिन। कृपया फेरि भन्नुहोस्।"
                return "Sorry, I couldn't understand the object name or location. Could you rephrase?"
            
            try:
                resp = requests.post(f"{BUN_API_URL}/objects", json={
                    "userId": user_id,
                    "objectName": obj_name,
                    "location": obj_location
                })
                if resp.status_code == 201:
                    if lang == "ne":
                        return f"बचत भयो! तपाईंको **{obj_name}** **{obj_location}** मा रेकर्ड गरिएको छ।"
                    return f"Saved! I've recorded that your **{obj_name}** is at **{obj_location}**."
                else:
                    return "Sorry, I couldn't save that right now. Please try again."
            except:
                return "Could not connect to the server to save the object."

        # --- MEDICINE ADD ---
        elif intent == "MEDICINE_ADD":
            extract_prompt = (
                f"Extract medicine details from this message.\n"
                f"RULES:\n"
                f"1. NAME: Only the medicine name (1-2 words). Do NOT include verbs like 'khana', 'khannuparne'.\n"
                f"2. DOSAGE: Strength (like 500mg) or quantity. If not mentioned, write 'unknown'.\n"
                f"3. TIME: Formal time (HH:MM AM/PM). '2 बजे' is 02:00 PM.\n\n"
                f"Message: \"{message}\"\n\n"
                f"Examples:\n"
                f"- 'I take paracetamol 500mg at 8 AM': NAME: paracetamol, DOSAGE: 500mg, TIME: 08:00 AM\n"
                f"- 'कफ सिरप खानुपर्नेछ दिउँसोको २ बजे': NAME: कफ सिरप, DOSAGE: unknown, TIME: 02:00 PM\n"
                f"- 'डाइजेन ५०० एमजी १ बजे': NAME: डाइजेन, DOSAGE: ५०० एमजी, TIME: 01:00 PM\n\n"
                f"Reply in this format:\n"
                f"NAME: <name>\n"
                f"DOSAGE: <dosage>\n"
                f"TIME: <time>"
            )
            extraction = llm_service.generate_response(extract_prompt).strip()
            
            med_name = ""
            med_dosage = ""
            med_time = ""
            for line in extraction.split("\n"):
                line = line.strip()
                if line.upper().startswith("NAME:"):
                    med_name = line.split(":", 1)[1].strip()
                elif line.upper().startswith("DOSAGE:"):
                    med_dosage = line.split(":", 1)[1].strip()
                elif line.upper().startswith("TIME:"):
                    med_time = line.split(":", 1)[1].strip()
            
            if not med_name or med_name.lower() == "unknown":
                if lang == "ne":
                    return "माफ गर्नुहोस्, म औषधिको नाम बुझ्न सकिन। कृपया फेरि भन्नुहोस्।"
                return "Sorry, I couldn't understand the medicine name. Could you rephrase?"
            
            if not med_dosage or med_dosage.lower() == "unknown":
                med_dosage = "As prescribed"
            if not med_time or med_time.lower() == "unknown":
                med_time = "Morning"
            
            try:
                resp = requests.post(f"{BUN_API_URL}/medicines", json={
                    "userId": user_id,
                    "name": med_name,
                    "dosage": med_dosage,
                    "schedule": [{"time": med_time, "status": "pending"}]
                })
                if resp.status_code == 201:
                    if lang == "ne":
                        return f"बचत भयो! **{med_name}** ({med_dosage}) — {med_time} मा खानुहोस् भनेर रेकर्ड गरिएको छ।"
                    return f"Saved! I've added **{med_name}** ({med_dosage}) scheduled at **{med_time}**."
                else:
                    return "Sorry, I couldn't save that medicine right now. Please try again."
            except:
                return "Could not connect to the server to save the medicine."

        # --- GENERAL ---
        else:
            system_prompt = self.PROMPT_GENERAL_NE if lang == "ne" else self.PROMPT_GENERAL_EN
            chat_messages = history or []
            chat_messages.append({"role": "user", "content": message})
            return llm_service.chat(chat_messages, system_prompt=system_prompt)

    def generate_report(self, user_id, history=None):
        """Generate a daily health report by analyzing chat history."""
        try:
            chat_history = history or []
            
            # Build a readable conversation log
            if chat_history:
                convo_lines = []
                for msg in chat_history[-30:]:  # Last 30 messages
                    role = "User" if msg.get("role") == "patient" else "Assistant"
                    convo_lines.append(f"{role}: {msg.get('content', '')}")
                conversation_text = "\n".join(convo_lines)
            else:
                conversation_text = "No conversation history available."

            # Step 1: Get mood score from LLM
            mood_prompt = (
                f"Analyze this conversation and rate the user's overall mood/wellbeing on a scale of 1 to 10.\n"
                f"1 = very distressed, 5 = neutral, 10 = very happy and healthy.\n\n"
                f"Conversation:\n{conversation_text}\n\n"
                f"Reply with ONLY a single number between 1 and 10. Nothing else."
            )
            mood_raw = llm_service.generate_response(mood_prompt).strip()
            
            # Extract the number
            mood_score = 5  # default
            for char in mood_raw:
                if char.isdigit():
                    val = int(char)
                    if 1 <= val <= 10:
                        mood_score = val
                        break
            # Handle "10" specifically
            if "10" in mood_raw:
                mood_score = 10

            # Step 2: Generate the summary report
            report_prompt = (
                f"You are a health companion AI. Based on the conversation history below, "
                f"write a brief daily wellness summary for the user.\n\n"
                f"Conversation:\n{conversation_text}\n\n"
                f"Rules:\n"
                f"1. Write ONLY in plain English.\n"
                f"2. Do NOT use any markdown formatting (no **, no #, no -, no bullet points).\n"
                f"3. Keep it concise, 5 to 8 sentences.\n"
                f"4. Summarize what topics were discussed.\n"
                f"5. Note the user's apparent mood and emotional state.\n"
                f"6. End with a brief personalized health tip.\n"
                f"7. If there is no conversation history, say so kindly."
            )
            report = llm_service.generate_response(
                report_prompt,
                system_prompt="You are a wellness report writer. Write concise summaries in plain English. Never use markdown."
            )
            
            # Strip any markdown that may have leaked through
            report = re.sub(r'\*\*?', '', report)
            report = re.sub(r'#+\s*', '', report)
            report = re.sub(r'^[-*]\s', '', report, flags=re.MULTILINE)
            
            return {
                "report": report.strip(),
                "moodScore": mood_score
            }
        except Exception as e:
            return {
                "report": f"Could not generate report: {str(e)}",
                "moodScore": 5
            }

swastha_agent = SwasthaAgent()
