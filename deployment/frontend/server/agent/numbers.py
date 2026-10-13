"""Reject generated figures that are absent from verified tool results."""
import math
import re
from decimal import Decimal

NUMBERS = re.compile(r'(?<![\w.])[-+−]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?')

def numeric_inputs(value, path=''):
    if isinstance(value, bool) or value is None:
        return []
    if isinstance(value, (int,float)):
        return [(float(value), path)] if math.isfinite(value) else []
    if isinstance(value, dict):
        return [item for key, child in value.items() for item in numeric_inputs(child, f'{path}.{key}')]
    if isinstance(value, (list,tuple)):
        return [item for child in value for item in numeric_inputs(child,path)]
    return []

def check_numbers(text, verified):
    inputs = numeric_inputs(verified)
    invalid = []
    for match in NUMBERS.finditer(text):
        value = float(match.group().replace(',','').replace('−','-'))
        context = text[match.end():match.end()+16].lower()
        allowed = False
        for number,path in inputs:
            candidates = [number, round(number), round(number,1), round(number,2)]
            if re.match(r'\s*(?:kl|m³|m3|kilolit)', context) and ('litre' in path or 'liters' in path):
                candidates += [number/1000,round(number/1000,1),round(number/1000,2)]
            if re.match(r'\s*(?:mwh|megawatt)', context) and 'kwh' in path:
                candidates += [number/1000,round(number/1000,1),round(number/1000,2)]
            if re.match(r'\s*%',context) and any(key in path for key in ['ratio','share','rate']):
                candidates += [number*100,round(number*100,1),round(number*100,2)]
            if any(math.isclose(value,candidate,rel_tol=1e-9,abs_tol=1e-9) for candidate in candidates):
                allowed=True
                break
        if not allowed:
            invalid.append(match.group())
    return {'passed': not invalid, 'unsupported_numbers': invalid}

def cap_words(text, limit):
    words=text.split()
    return text if len(words)<=limit else ' '.join(words[:limit]).rstrip('.,;:')+'.'
