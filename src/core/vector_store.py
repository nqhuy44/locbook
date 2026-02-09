import chromadb
import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types
from chromadb.utils import embedding_functions
from src.config import get_settings

logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self):
        self.settings = get_settings()
        
        if self.settings.CHROMA_SERVER_HOST:
            logger.info(f"Connecting to ChromaDB at {self.settings.CHROMA_SERVER_HOST}:{self.settings.CHROMA_SERVER_PORT}")
            self.client = chromadb.HttpClient(
                host=self.settings.CHROMA_SERVER_HOST, 
                port=self.settings.CHROMA_SERVER_PORT
            )
        else:
            self.client = chromadb.PersistentClient(path="data/chroma_db")
        
        # Google Generative AI Embedding Function
        # We need to wrap it to match ChromaDB's expected interface if not available
        # Or just use raw calls. Chroma has a google embedding function but let's be explicit.
        
        if self.settings.GEMINI_API_KEY:
            self.genai_client = genai.Client(api_key=self.settings.GEMINI_API_KEY)
        else:
            self.genai_client = None
            
        self.collection = self.client.get_or_create_collection(
            name="locbook_places",
            metadata={"hnsw:space": "cosine"}
        )

    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding using Gemini"""
        if not self.genai_client: return []
        
        # Model: embedding-001 or text-embedding-004
        try:
            result = self.genai_client.models.embed_content(
                model="models/gemini-embedding-001",
                contents=text,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    title="Place Embedding"
                )
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return []

    def add_place(self, place: Dict[str, Any]):
        """Add a single place to Vector DB"""
        self.add_places([place])

    def delete_place(self, place_id: str):
        """Delete a place from Vector DB"""
        try:
            self.collection.delete(ids=[place_id])
            logger.info(f"Deleted place {place_id} from ChromaDB")
        except Exception as e:
            logger.error(f"Failed to delete place {place_id}: {e}")

    def add_places(self, places: List[Dict[str, Any]]):
        """
        Add places to Vector DB.
        places: List of dicts with keys: id, text, metadata
        """
        ids = []
        embeddings = []
        metadatas = []
        documents = []

        for p in places:
            text = p.get("text", "")
            if not text: continue
            
            embedding = self.get_embedding(text)
            if not embedding: continue
            
            ids.append(str(p["id"]))
            embeddings.append(embedding)
            metadatas.append(p["metadata"])
            documents.append(text)

        if ids:
            self.collection.upsert(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=documents
            )
            logger.info(f"Upserted {len(ids)} places to ChromaDB")

    def search(self, query: str, limit: int = 5, where: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Search for similar places with optional metadata filtering.
        """
        try:
            if not self.genai_client: return []

            query_embedding_result = self.genai_client.models.embed_content(
                model="models/gemini-embedding-001",
                contents=query,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_QUERY"
                )
            )
            
            embedding_vector = query_embedding_result.embeddings[0].values
            
            results = self.collection.query(
                query_embeddings=[embedding_vector],
                n_results=limit,
                where=where  # Pass filtering criteria to ChromaDB
            )
            
            # Format results
            parsed_results = []
            if results['ids']:
                for i in range(len(results['ids'][0])):
                    parsed_results.append({
                        "id": results['ids'][0][i],
                        "score": results['distances'][0][i] if 'distances' in results else 0,
                        "metadata": results['metadatas'][0][i] if 'metadatas' in results else {},
                        "document": results['documents'][0][i] if 'documents' in results else ""
                    })
            
            return parsed_results
            
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

# Singleton instance
vector_store = VectorStore()
