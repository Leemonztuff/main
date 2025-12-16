
# Estado del Proyecto: Epic Earth - Shards of Eternum

**Versión:** 1.8 (Stabilization & Docs)
**Fecha:** 25 de Mayo, 2024
**Estado:** Stable Core (Combate, Exploración, Persistencia, Invocación)

Este documento es la **Fuente de la Verdad**. Cualquier desarrollo futuro debe adherirse a las arquitecturas y restricciones aquí definidas para garantizar la estabilidad.

---

## 1. Stack Tecnológico & Arquitectura

*   **Core:** React 18 + TypeScript.
*   **Estado Global:** `zustand` con **Patrón de Slices**.
    *   *Regla:* El estado está fragmentado en `playerSlice`, `battleSlice`, `inventorySlice`, `overworldSlice`. No mezclar lógica directamente; usar acciones públicas.
*   **Renderizado 3D (Batalla):** `three.js` + `@react-three/fiber`.
    *   *Regla:* Uso estricto de `InstancedMesh` para el terreno y decoraciones.
*   **Gestión de Assets:** Carga dinámica vía `AssetManager` + CDN (jsDelivr/GitHub Raw).
*   **Audio:** 100% Procedural (Web Audio API). Sin archivos de audio externos.

---

## 2. Invariantes del Sistema (CRÍTICO: NO TOCAR)

Estas son las columnas vertebrales que mantienen la aplicación estable. **No modificar sin una razón de peso mayor.**

### 2.1. Pipeline de Renderizado de Batalla (`BattleScene.tsx`)
El renderizado no es monolítico. Está dividido en capas con manejo de errores granular:
1.  **`BattleAssetsLoader`:** Componente invisible que suspende la escena (`Suspense`) hasta que las texturas calculadas por `AssetManager.getAllBattleAssets()` estén listas.
2.  **`TextureErrorBoundary`:** Wrapper obligatorio para cualquier componente que use texturas. Si una URL falla (404), captura el error y renderiza un *Fallback Geométrico* (Cajas/Cápsulas) en lugar de crashear todo el juego (Pantalla Blanca de la Muerte).
3.  **Capas:**
    *   `TerrainLayer`: Voxels instanciados.
    *   `DecorationLayer`: Sprites instanciados (Pasto, Rocas).
    *   `InteractionLayer`: Cursores, Grillas, AOE (Instanced, no geometry individual).
    *   `EntityRenderer`: Unidades (Billboards o Voxels).

### 2.2. Mecánica de Invocación (Entropía)
*   **Fuente:** Cámara del usuario (`getUserMedia`) o Ruido Simulado.
*   **Proceso:** Imagen -> Muestreo de Píxeles -> Hash FNV-1a -> Semilla Numérica.
*   **Determinismo:** Una misma semilla visual **siempre** debe generar el mismo personaje (Raza, Clase, Stats).
*   **Persistencia:** Los personajes invocados van al `characterPool` y son entidades serializables completas.

### 2.3. Sistema de Audio (`SoundSystem.ts`)
*   **Restricción:** Prohibido importar archivos `.mp3` / `.wav`.
*   **Implementación:** Osciladores sintetizados en tiempo real. Esto garantiza tiempos de carga cero y funcionamiento offline.

---

## 3. Especificaciones de Mecánicas Complejas

### 3.1. Transformación (Druid Wild Shape)
Esta mecánica altera el estado fundamental de una entidad y debe manejarse con cuidado en `battleSlice`.
*   **Activación:** Skill con efecto `TRANSFORM` y `summonDefId`.
*   **Estado:**
    *   Se hace backup de `stats` originales en `entity.stats.originalStats`.
    *   Se hace backup del sprite en `entity.stats.originalSprite`.
    *   Se reemplazan HP, AC, Velocidad y Atributos Físicos (STR, DEX, CON) por los de la bestia.
    *   Se mantiene la Inteligencia/Wisdom/Charisma y el Nivel del personaje original.
*   **Daño y Reversión:**
    *   El daño se aplica al HP de la forma bestial (HP Temporal).
    *   Si HP <= 0: Se restaura `originalStats` y `originalSprite`.
    *   **Daño Excedente:** El daño sobrante se aplica al HP de la forma original (Regla D&D 5e).

### 3.2. Sistema de Hechizos y Animaciones
*   **Definición:** Los hechizos en `constants.ts` (`SPELLS`) definen una `animation` key (ej: 'MAGIC', 'HEAL', 'EXPLOSION').
*   **Renderizado:** `SpellEffectsRenderer` busca esta key en `ASSETS.ANIMATIONS` para reproducir la secuencia de sprites.
*   **Tipos de Efecto:**
    *   `PROJECTILE`: Viaja de A a B.
    *   `BURST`: Estático en el objetivo (con radio AOE).
    *   `BEAM`: Curva de Bezier entre A y B.

---

## 4. Deuda Técnica y Roadmap

### 🔴 Prioridad Alta (Riesgo de Escalabilidad)
1.  **Resolución de Acciones (`battleSlice.ts` -> `performSkill`):**
    *   Actualmente es una función gigante con múltiples `if/else` (`if effect == 'TRANSFORM'`, `if effect == 'HEAL'`).
    *   **Necesidad:** Refactorizar a un patrón **Command** o **Strategy** (ej: `ActionResolver.process(effect, context)`).
2.  **Monolito `constants.ts`:**
    *   El archivo contiene definiciones de UI, reglas de juego, URLs de assets y tablas de loot.
    *   **Necesidad:** Dividir en `data/items.ts`, `data/bestiary.ts`, `config/assets.ts`.

### 🟡 Prioridad Media
3.  **IA Enemiga:**
    *   Los enemigos usan un `findPath` básico y atacan. No usan habilidades de soporte ni posicionamiento táctico avanzado.
4.  **Performance Overworld:**
    *   El `OverworldMap` redibuja el canvas completo en cada frame de movimiento. Debería usar *offscreen canvas* para el terreno estático.

---

## 5. Changelog Reciente

*   **v1.8 (Docs):** Consolidación de documentación y especificaciones técnicas.
*   **v1.7.5 (Fix):** Corrección en `constants.ts` para incluir animaciones faltantes (`MAGIC`, `HOLY`, `DARK`) y cierre correcto de llaves.
*   **v1.7 (Summoner):** Invocación por cámara, Gestión de Party y Servicios de Ciudad.
*   **v1.6 (Druid):** Wild Shape y HP Buffer.
