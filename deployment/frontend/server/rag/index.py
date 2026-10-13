"""Sector-folder document parsing, numbered clauses and numpy cosine search."""
from pathlib import Path
from hashlib import sha256
import re
import yaml
import numpy as np

def document_chunks(directory,sector):
    chunks=[]
    for file in sorted(Path(directory).glob('*.md')):
        text=file.read_text(encoding='utf-8')
        match=re.match(r'^---\s*\n(.*?)\n---\s*\n',text,re.S)
        if not match:
            continue
        metadata=yaml.safe_load(match.group(1)) or {}
        if metadata.get('active') is False:
            continue
        for part in re.split(r'(?m)(?=^## )',text[match.end():]):
            lines=part.strip().splitlines()
            if not lines or not lines[0].startswith('## '):
                continue
            heading=lines[0].lstrip('# ').strip()
            clauses=list(re.finditer(r'(?m)^(\d+)\.\s+(.+?)(?=\n\d+\.\s|\Z)','\n'.join(lines[1:]).strip(),re.S))
            for clause in clauses:
                number=int(clause.group(1));content=clause.group(2).strip()
                source=f"{metadata['id']}:c{number}"
                chunks.append({'id':sha256(f'{sector}:{source}:{content}'.encode()).hexdigest(),'source_id':source,
                    'sector':sector,'document_id':metadata['id'],'title':metadata['title'],'domain':metadata.get('domain'),
                    'applies_when':metadata.get('applies_when'),'clause_number':number,'heading':heading,'content':content,
                    'source':source,'kind':'procedure','placeholder':bool(metadata.get('placeholder',True))})
    return chunks

def cosine_scores(query,vectors):
    query=np.asarray(query,dtype=float).reshape(-1)
    vectors=np.asarray(vectors,dtype=float)
    denominator=np.linalg.norm(vectors,axis=1)*np.linalg.norm(query)
    return np.divide(vectors@query,denominator,out=np.zeros(len(vectors)),where=denominator>0)
