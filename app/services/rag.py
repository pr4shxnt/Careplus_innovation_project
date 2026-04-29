import os
import re

class RAGService:
    def __init__(self, kb_dir="data/kb"):
        self.kb_dir = kb_dir
        self.chunks = []
        self._load_chunks()

    def _load_chunks(self):
        if not os.path.exists(self.kb_dir):
            return
            
        for filename in os.listdir(self.kb_dir):
            if filename.endswith(".txt"):
                with open(os.path.join(self.kb_dir, filename), "r", encoding="utf-8") as f:
                    content = f.read()
                    # Improved chunking: Keep Q&A together by splitting on the section separators
                    file_chunks = re.split(r'────────────────────────────────────|════════════════════════════════════', content)
                    for chunk in file_chunks:
                        if chunk.strip():
                            self.chunks.append({
                                "content": chunk.strip(),
                                "source": filename
                            })

    def retrieve(self, query, top_k=3):
        # Enhanced keyword matching: stop words and weighting
        stop_words = [
            "is", "the", "a", "an", "on", "in", "my", "me", "how", "what", "where",
            "छ", "छन्", "हो", "होइन", "मेरो", "मैले", "के", "कसरी", "कता", "कहाँ", "अनि", "र", "वा"
        ]
        
        raw_keywords = query.lower().split()
        keywords = [kw.strip('.,?!()') for kw in raw_keywords if kw not in stop_words]
        
        # If all words were stop words, use raw keywords
        if not keywords:
            keywords = raw_keywords

        scored_chunks = []
        for chunk in self.chunks:
            score = 0
            content_lower = chunk["content"].lower()
            for kw in keywords:
                if kw in content_lower:
                    # Higher weight for longer words
                    score += (len(kw) * 1.5)
            if score > 0:
                scored_chunks.append((score, chunk))
        
        # Sort by score descending
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        
        # Only return chunks with positive score
        results = [chunk for score, chunk in scored_chunks if score > 0]
        return results[:top_k]

rag_service = RAGService()
