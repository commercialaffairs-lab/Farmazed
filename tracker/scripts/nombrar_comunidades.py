#!/usr/bin/env python3
"""Nombra las comunidades de graph.json SIN LLM, de forma determinista (TAREA 43).

Uso: nombrar_comunidades.py <graph.json>  ->  JSON {id_comunidad: "nombre"} por stdout
(el formato de `graphify export html --labels`). El nombre sale de los 2 archivos donde viven más
nodos de la comunidad y su símbolo más conectado: "cases.js + transitions.js · applyTransition".
"""
import json, os, sys
from collections import Counter

g = json.load(open(sys.argv[1]))
grado = Counter()
for e in g['links']:
    grado[e['source']] += 1
    grado[e['target']] += 1

por_comunidad = {}
for n in g['nodes']:
    por_comunidad.setdefault(n.get('community'), []).append(n)

nombres = {}
for cid, nodos in sorted(por_comunidad.items(), key=lambda kv: str(kv[0])):
    archivos = Counter(os.path.basename(n.get('source_file') or '') for n in nodos if n.get('source_file'))
    top_archivos = ' + '.join(a for a, _ in archivos.most_common(2)) or 'sin archivo'
    simbolos = [n for n in nodos if n.get('label') and n.get('source_file') and n['label'] != os.path.basename(n['source_file'])]
    clave = max(simbolos, key=lambda n: (grado[n['id']], n['label']), default=None)
    nombres[str(cid)] = f"{top_archivos} · {clave['label'].rstrip('()')}" if clave else top_archivos

json.dump(nombres, sys.stdout, ensure_ascii=False, indent=1)
