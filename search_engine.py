"""
Full-text search engine for the Navy QOL knowledge base.
Uses Whoosh for indexing and retrieval with TF-IDF ranking.
"""
import os
import json
from whoosh import index
from whoosh.fields import Schema, TEXT, ID, KEYWORD
from whoosh.qparser import MultifieldParser, OrGroup
from whoosh.analysis import StemmingAnalyzer

INDEX_DIR = os.path.join(os.path.dirname(__file__), "search_index")
KB_DIR = os.path.join(os.path.dirname(__file__), "knowledge_base")

schema = Schema(
    doc_id=ID(stored=True, unique=True),
    source=TEXT(stored=True),
    category=TEXT(stored=True),
    title=TEXT(stored=True, analyzer=StemmingAnalyzer()),
    content=TEXT(stored=True, analyzer=StemmingAnalyzer()),
    tags=KEYWORD(stored=True, commas=True, lowercase=True, scorable=True),
)


def build_index():
    """Load all JSON knowledge base files and build the search index."""
    if not os.path.exists(INDEX_DIR):
        os.makedirs(INDEX_DIR)
    ix = index.create_in(INDEX_DIR, schema)
    writer = ix.writer()
    for filename in os.listdir(KB_DIR):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(KB_DIR, filename)
        with open(filepath, "r") as f:
            entries = json.load(f)
        for entry in entries:
            writer.add_document(
                doc_id=entry["id"],
                source=entry.get("source", ""),
                category=entry.get("category", ""),
                title=entry.get("title", ""),
                content=entry.get("content", ""),
                tags=",".join(entry.get("tags", [])),
            )
    writer.commit()
    return ix


def get_index():
    """Open existing index or build a new one."""
    if index.exists_in(INDEX_DIR):
        return index.open_dir(INDEX_DIR)
    return build_index()


def search(query_text, limit=5):
    """Search the knowledge base and return ranked results."""
    ix = get_index()
    parser = MultifieldParser(
        ["title", "content", "tags", "category"],
        schema=ix.schema,
        group=OrGroup,
        fieldboosts={"tags": 3.0, "title": 2.0, "content": 1.0, "category": 1.5},
    )
    with ix.searcher() as searcher:
        query = parser.parse(query_text)
        results = searcher.search(query, limit=limit)
        hits = []
        for hit in results:
            hits.append({
                "id": hit["doc_id"],
                "source": hit["source"],
                "category": hit["category"],
                "title": hit["title"],
                "content": hit["content"],
                "tags": hit["tags"],
                "score": hit.score,
            })
    return hits


def rebuild_index():
    """Force a full index rebuild."""
    import shutil
    if os.path.exists(INDEX_DIR):
        shutil.rmtree(INDEX_DIR)
    return build_index()
