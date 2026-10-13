"""Local retrieval with explicit sector, cutoff and source provenance."""
from pathlib import Path
from hashlib import sha256
from functools import lru_cache
from datetime import datetime
import json
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import select, insert, update
from app.config import settings
from app.db import get_table
from server.config import ROOT, configuration
from server.rag.index import document_chunks,cosine_scores

def anonymize(text):
    text = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[email removed]', str(text))
    return re.sub(r'(?<![\w:])(?:\+91[ -]?)?[6-9]\d{9}(?!\w)', '[contact removed]', text)

def anonymize_payload(value):
    if isinstance(value,str):
        return anonymize(value)
    if isinstance(value,dict):
        return {key:anonymize_payload(item) for key,item in value.items()}
    if isinstance(value,(list,tuple)):
        return [anonymize_payload(item) for item in value]
    return value

def procedure_chunks(sector):
    return document_chunks(ROOT/'knowledge'/sector,sector)

def case_chunks(session, sector, as_of, node):
    from app.engine.scopes import entity_nodes
    from app import replay_calendar
    from server.storage import tables
    from zoneinfo import ZoneInfo
    def at(value):
        parsed = datetime.fromisoformat(value) if isinstance(value,str) else value
        return parsed.replace(tzinfo=ZoneInfo('Asia/Kolkata')) if parsed.tzinfo is None else parsed
    allowed = entity_nodes(session, node, as_of)
    chunks = []
    for table_name, id_key, closed in [('actions','action_id',['done']),('complaints','complaint_id',['resolved']),('safety_incidents','incident_id',['closed'])]:
        table = get_table(table_name)
        timestamp = table.c.created_at if 'created_at' in table.c else table.c.timestamp
        cutoff = as_of - replay_calendar.offset() if table_name == 'safety_incidents' else as_of
        statement = select(table).where(timestamp <= cutoff, table.c.status.in_(closed))
        if node != 'F01':
            field = table.c.node_id if 'node_id' in table.c else table.c.area_id
            statement = statement.where(field.in_(allowed))
        rows = session.execute(statement.order_by(timestamp.desc()).limit(50)).mappings()
        for row in rows:
            payload = json.loads(row.get('payload') or '{}') if 'payload' in row else {}
            if table_name == 'actions':
                history = payload.get('history',[])
                completed = [event for event in history if event.get('to') == 'done' and event.get('at') and at(event['at']) <= as_of]
                if not completed or any(event.get('at') and at(event['at']) > as_of for event in history): continue
            elif table_name == 'complaints':
                events = tables().tables['complaint_events']
                event = session.execute(select(events.c.payload).where(events.c.complaint_id == row[id_key],events.c.created_at <= as_of).order_by(events.c.created_at.desc()).limit(1)).scalar()
                historical = json.loads(event).get('after',{}) if event else {}
                if historical.get('status') != 'resolved': continue
                payload = historical
            content = row.get('text') or row.get('description') or payload.get('text')
            notes = payload.get('resolution_notes') or payload.get('reply') or ''
            if not content and not notes:
                continue
            chunks.append({'id': f'{table_name}:{row[id_key]}', 'sector': sector, 'document_id': table_name,
                'heading': f'Resolved {table_name}', 'content': anonymize(f'{content or ""}\n{notes}'),
                'source': f'{table_name}/{row[id_key]}', 'kind': 'case', 'placeholder': False})
    return chunks

@lru_cache(maxsize=2)
def embedding_model(name):
    try:
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer(name, local_files_only=True)
    except (ImportError, OSError, RuntimeError):
        return None

def search(session, query, sector, node, as_of, limit=None):
    if sector != settings.sector:
        raise ValueError('Search is limited to the configured active sector')
    chunks = procedure_chunks(sector) + case_chunks(session, sector, as_of, node)
    if not chunks or not query.strip():
        return {'method': 'empty', 'results': []}
    texts = [f'{chunk["heading"]}\n{chunk["content"]}' for chunk in chunks]
    model = embedding_model(configuration()['retrieval']['embedding_model'])
    if model is not None:
        vectors = model.encode(texts + [query], normalize_embeddings=True)
        scores = cosine_scores(vectors[-1],vectors[:-1])
        method = 'local_embeddings'
    else:
        vectorizer = TfidfVectorizer(ngram_range=(1,2), stop_words='english')
        try:
            vectors = vectorizer.fit_transform(texts + [query])
            scores = cosine_scores(vectors[-1].toarray()[0],vectors[:-1].toarray())
        except ValueError:
            return {'method': 'tfidf', 'results': []}
        method = 'tfidf'
    count = limit if limit is not None else int(configuration()['retrieval']['top_k'])
    results = [{**chunks[index], 'similarity': float(scores[index]),'score':float(scores[index])} for index in np.argsort(-scores)[:count] if scores[index] >= float(configuration()['retrieval']['minimum_score'])]
    table = get_table('knowledge_chunks')
    for result in results:
        values = {'sector': sector, 'document_id': result['document_id'], 'content': result['content'],
            'metadata_json': json.dumps({key: result[key] for key in ['heading','source','kind','placeholder']})}
        if session.execute(select(table.c.chunk_id).where(table.c.chunk_id == result['id'])).first():
            session.execute(update(table).where(table.c.chunk_id == result['id']).values(**values))
        else:
            session.execute(insert(table).values(chunk_id=result['id'], **values))
    return {'method': method, 'results': results}
