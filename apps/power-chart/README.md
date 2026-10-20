# Power Chart (prototipo)

Power Chart interactivo de stakeholders (React Flow + dagre). Datos: 30 PG targets del Account Plan FY27 de MAPFRE.

```
npm install
npm run dev     # http://localhost:5173
npm run build   # dist/index.html autocontenido
```

- Arrastra una tarjeta sobre otra para cambiar a quién reporta.
- Arrastra desde el punto inferior a otra tarjeta para añadir una línea de influencia.
- Modo Gaps resalta los huecos MEDDPICC; Exportar YAML genera `stakeholders.yaml`.
