
# Informe Técnico de Desarrollo: Arcadia Tactics

**Versión:** 1.4 (Architecture Update)  
**Fecha:** 25 de Mayo, 2024  
**Stack Tecnológico:** React 19, TypeScript, Zustand, Three.js (@react-three/fiber), Tailwind CSS.

---

## 1. Resumen Ejecutivo
Arcadia Tactics es un RPG táctico híbrido que combina exploración de mundo abierto en 2D (estilo *Battle for Wesnoth*) con combates tácticos en 3D (estilo Voxel/Minecraft), utilizando una adaptación simplificada de las reglas de D&D 5ª Edición.

El proyecto cuenta con un ciclo de juego funcional (Core Loop): Creación de personaje -> Exploración -> Combate -> Loot/XP -> Gestión de Inventario.

---

## 2. Sistemas Implementados

### 2.1. Arquitectura y Estado (Zustand)
- **Store Modular (Slice Pattern):** La lógica de estado se ha refactorizado en "Slices" independientes para mejorar la mantenibilidad y organización:
  - `battleSlice`: Máquina de estados de combate, turnos y acciones tácticas.
  - `overworldSlice`: Navegación, generación de mapa y lógica de viaje.
  - `inventorySlice`: Gestión de objetos, equipamiento y consumo.
  - `playerSlice`: Estadísticas del jugador, creación de personaje y level up.
  - `commonSlice`: Utilidades compartidas como logs del sistema.
- **ECS (Entity Component System) Ligero:** Las entidades (Jugador, Enemigos) se definen mediante componentes de datos (`CombatStats`, `Position`, `Visual`).

### 2.2. Generación de Mundo (Overworld)
- **Algoritmo Procedural:** Utiliza Ruido Perlin (simulado) para generar elevación, humedad y temperatura.
- **Biomas Dinámicos:** Soporte para Bosques, Desiertos, Tundra, Taiga, Pantanos, etc.
- **Dual Dimension System:** Generación simultánea de dos mundos ("Normal" y "Upside Down/Shadow Realm") sincronizados geográficamente pero con biomas corruptos.
- **Visualización 2D:**
  - Renderizado Hexagonal SVG.
  - **Autotiling:** Implementación completa de transiciones de terreno estilo Wesnoth (bordes suaves entre tipos de terreno).
  - **Sistema de Clima:** Capas visuales para Lluvia, Nieve, Niebla y Ceniza.
  - **Portales:** Mecánica de viaje entre dimensiones.

### 2.3. Sistema de Combate (Battle Scene)
- **Renderizado 3D:** Uso de Three.js para visualizar el terreno de combate basado en la celda del Overworld (Voxels con texturas de Minecraft).
- **Unidades:** Renderizado tipo "Billboard" (Sprites 2D en entorno 3D) con barras de vida y animaciones de "respiración".
- **Lógica de Turnos:** Sistema de iniciativa basado en D&D (d20 + DEX).
- **Acciones:**
  - Movimiento (Grid-based).
  - Ataque Melee (Cálculo de AC vs Attack Roll).
  - Magia (Sistema de hechizos con slots de maná y efectos visuales básicos).
  - Uso de Objetos.
- **Persistencia Ambiental:** El clima del Overworld se transfiere a la batalla (iluminación, partículas, niebla).

### 2.4. Inventario y Equipamiento
- **Base de Datos:** Items definidos en `constants.ts` (Armas, Armaduras, Pociones).
- **Gestión:** Capacidad de equipar/desequipar items en slots específicos (Main Hand, Off Hand, Body).
- **Recálculo de Stats:** La CA (Clase de Armadura) y el Daño se actualizan dinámicamente según el equipo.
- **UI:** Interfaz de "Paper Doll" y lista de inventario funcional.

### 2.5. Audio
- **Sintetizador Web Audio API:** Sistema de sonido procedural sin assets externos (reduce tiempos de carga). Soporta SFX para UI, pasos, magia y combate.

### 2.6. Gestión de Assets
- **AssetManager Centralizado:** Servicio dedicado para determinar y precargar texturas requeridas por bioma y entidad antes de renderizar la escena de batalla, evitando "pop-in" visual y errores de carga.

---

## 3. Funcionalidades Incompletas (To-Do)

### 3.1. Inteligencia Artificial (IA)
- **Estado Actual:** Muy básica. Los enemigos se mueven en línea recta hacia el jugador y atacan si están adyacentes.
- **Faltante:**
  - Pathfinding real (A* o Dijkstra) para navegar obstáculos en combate.
  - Uso de habilidades especiales o hechizos por parte de enemigos.
  - Comportamientos tácticos (huir, flanquear).

### 3.2. Contenido
- **Variedad de Enemigos:** Solo existen "Goblins" y "Shadow Stalkers" genéricos. Faltan modelos/sprites y stats para bosses o variaciones.
- **Misiones (Quests):** La estructura de datos existe, pero no hay lógica de triggers, NPCs o recompensas por misiones.
- **Loot Tables:** El loot es estático o inexistente tras la batalla (solo XP/Gold fijos).

### 3.3. Motor de Combate 3D
- **Colisiones y Altura:** El mapa 3D se genera con alturas, pero la lógica de movimiento no tiene en cuenta "saltos" o bloqueos por diferencia de altura excesiva.
- **Línea de Visión (LoS):** Se puede atacar a través de paredes o voxels altos.

---

## 4. Deuda Técnica y Riesgos

1.  **Dependencia de Assets Externos:**
    - El proyecto hace *hotlinking* directo a repositorios de GitHub (Wesnoth/Minecraft textures).
    - **Riesgo:** Si esos repositorios cambian de estructura o bloquean el tráfico, el juego perderá todas sus texturas.
    - **Solución:** Descargar assets y servirlos localmente desde la carpeta `public` (Script `download_assets.mjs` disponible).

2.  **Lógica de Movimiento:**
    - El cálculo de rango de movimiento es una distancia Manhattan simple. No tiene en cuenta costes de terreno (moverse por agua/montaña debería costar más).

---

## 5. Hoja de Ruta Sugerida (Roadmap)

1.  **Prioridad Alta:** Mejorar la IA enemiga con algoritmo A* y comportamientos variados.
2.  **Prioridad Media:** Expandir el sistema de efectos para soportar habilidades más complejas.
3.  **Prioridad Media:** Implementar persistencia básica (`localStorage`) robusta con versionado.
4.  **Prioridad Baja:** Añadir NPCs y sistema de diálogo simple en el Overworld.
