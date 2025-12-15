
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { HexCell, TerrainType, PositionComponent, WeatherType, Dimension, GameState } from '../types';
import { HEX_SIZE, TERRAIN_COLORS, ASSETS } from '../constants';
import { useGameStore } from '../store/gameStore';
import { findPath } from '../services/pathfinding';
import { WorldGenerator } from '../services/WorldGenerator';
import { calculateVisionRange } from '../services/dndRules';

interface OverworldMapProps {
  mapData: HexCell[] | null; 
  playerPos: PositionComponent;
  onMove: (q: number, r: number) => void;
  dimension: Dimension;
  width: number;
  height: number;
}

const HEX_WIDTH = HEX_SIZE * 2;
const HEX_HEIGHT = Math.sqrt(3) * HEX_SIZE;
const HORIZ_DIST = HEX_SIZE * 1.5;
const VERT_DIST = HEX_HEIGHT;

const hexToPixel = (q: number, r: number) => ({ x: q * HORIZ_DIST, y: (r + q / 2) * VERT_DIST });

const pixelToAxial = (x: number, y: number) => {
  const q = (2 / 3 * x) / HEX_SIZE;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / HEX_SIZE;
  return axialRound(q, r);
};

const axialRound = (q: number, r: number) => {
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(-q - r);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - (-q - r));

    if (qDiff > rDiff && qDiff > sDiff) {
        rq = -rr - rs;
    } else if (rDiff > sDiff) {
        rr = -rq - rs;
    }
    return { q: rq, r: rr };
};

// --- SPRITE LOADER HOOK ---
const useSpriteLoader = (additionalSprites: string[] = []) => {
    const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const urlsToLoad = new Set<string>();
        
        // 1. Base Assets
        Object.values(ASSETS.TERRAIN).forEach(url => urlsToLoad.add(url));
        Object.values(ASSETS.OVERLAYS).forEach(val => {
            if (Array.isArray(val)) val.forEach(v => urlsToLoad.add(v));
            else urlsToLoad.add(val as string);
        });
        if (ASSETS.TEMPLE_ICON) urlsToLoad.add(ASSETS.TEMPLE_ICON);
        if (ASSETS.PORTAL_ICON) urlsToLoad.add(ASSETS.PORTAL_ICON);
        if (ASSETS.UNITS.PLAYER) urlsToLoad.add(ASSETS.UNITS.PLAYER);

        // 2. Dynamic Sprites (Enemies)
        additionalSprites.forEach(url => {
            if (url) urlsToLoad.add(url);
        });

        const loadedImages: Record<string, HTMLImageElement> = {};
        let loadedCount = 0;

        urlsToLoad.forEach(url => {
            const img = new Image();
            img.src = url;
            img.onload = () => {
                loadedCount++;
                setVersion(v => v + 1); 
            };
            img.onerror = () => {
                // Silent fail or placeholder
            };
            loadedImages[url] = img;
        });

        setImages(loadedImages);
    }, [JSON.stringify(additionalSprites)]); // Reload if enemy list changes

    return images;
};

export const WeatherOverlay: React.FC<{ type: WeatherType }> = ({ type }) => {
    if (type === WeatherType.NONE) return null;

    let bgImage = 'none';
    let animation = 'none';
    let opacity = 0.3;
    let bgColor = 'transparent';

    switch (type) {
        case WeatherType.RAIN:
            bgImage = `url(${ASSETS.WEATHER.RAIN})`;
            animation = 'fall 0.5s linear infinite';
            break;
        case WeatherType.SNOW:
            bgColor = 'rgba(255, 255, 255, 0.15)';
            break;
        case WeatherType.ASH:
            bgColor = 'rgba(80, 40, 0, 0.2)';
            break;
        case WeatherType.FOG:
            bgColor = 'rgba(200, 200, 200, 0.3)';
            break;
        case WeatherType.RED_STORM:
            bgColor = 'rgba(150, 0, 0, 0.2)';
            break;
    }

    return (
        <div 
            style={{ 
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, // Z-Index < UI (20)
                backgroundImage: bgImage, backgroundColor: bgColor, animation, opacity
            }} 
        />
    );
};

export const OverworldMap: React.FC<OverworldMapProps> = ({ mapData, playerPos, onMove, dimension }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Connect to Store State
    const { exploredTiles, activeOverworldEnemies, party } = useGameStore();
    
    // Calculate required sprites including enemies
    const enemySprites = useMemo(() => {
        return activeOverworldEnemies
            .filter(e => e.dimension === dimension)
            .map(e => e.sprite);
    }, [activeOverworldEnemies, dimension]);

    const images = useSpriteLoader(enemySprites);
    
    // Viewport State
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hoverPath, setHoverPath] = useState<HexCell[]>([]);
    const [hoveredCell, setHoveredCell] = useState<HexCell | null>(null);
    const lastHoverRef = useRef({ q: -999, r: -999 });

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && containerRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
                centerOnPlayer();
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize(); 
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const centerOnPlayer = useCallback(() => {
        if (!containerRef.current) return;
        const centerPixel = hexToPixel(playerPos.x, playerPos.y);
        const centerX = containerRef.current.clientWidth / 2;
        const centerY = containerRef.current.clientHeight / 2;
        setOffset({ x: centerX - centerPixel.x, y: centerY - centerPixel.y });
    }, [playerPos]);

    useEffect(() => {
        centerOnPlayer();
    }, [playerPos.x, playerPos.y, centerOnPlayer]);

    // --- DRAW LOOP ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        // Background
        ctx.fillStyle = dimension === Dimension.UPSIDE_DOWN ? '#0f0518' : '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const startX = -offset.x - HEX_SIZE * 2;
        const startY = -offset.y - HEX_SIZE * 2;
        const endX = startX + canvas.width + HEX_SIZE * 4;
        const endY = startY + canvas.height + HEX_SIZE * 4;

        // Helper to check if a tile is currently visible (Line of Sight / Fog of War)
        // In this simplified model, we calculate it dynamically based on the player position + explored set
        const visionRange = calculateVisionRange(party[0]?.stats.attributes.WIS || 10, party[0]?.stats.corruption || 0);
        const isTileVisible = (q: number, r: number) => {
            if (mapData) return true; // Town is fully visible usually
            const dist = (Math.abs(q - playerPos.x) + Math.abs(q + r - playerPos.x - playerPos.y) + Math.abs(r - playerPos.y)) / 2;
            return dist <= visionRange;
        };

        const drawTile = (cell: HexCell, isPathPreview = false) => {
            const { x, y } = hexToPixel(cell.q, cell.r);
            const screenX = x + offset.x;
            const screenY = y + offset.y;

            if (screenX < -HEX_SIZE * 2 || screenX > canvas.width + HEX_SIZE * 2 || 
                screenY < -HEX_SIZE * 2 || screenY > canvas.height + HEX_SIZE * 2) return;

            // Hex Shape Path
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = 2 * Math.PI / 6 * i;
                const hx = screenX + (HEX_SIZE + 1) * Math.cos(angle);
                const hy = screenY + (HEX_SIZE + 1) * Math.sin(angle);
                if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
            }
            ctx.closePath();

            const isVisible = isTileVisible(cell.q, cell.r);

            // 1. DRAW BASE TERRAIN
            if (cell.isExplored || mapData) { 
                const baseTextureUrl = ASSETS.TERRAIN[cell.terrain];
                const baseImg = images[baseTextureUrl];

                if (baseImg && baseImg.complete && baseImg.naturalWidth > 0) {
                    ctx.save();
                    ctx.clip();
                    ctx.drawImage(baseImg, screenX - HEX_SIZE, screenY - HEX_SIZE * Math.sqrt(3)/2, HEX_SIZE * 2, HEX_SIZE * Math.sqrt(3));
                    
                    // Fog of War (Explored but not currently visible)
                    if (!isVisible && !mapData) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                        ctx.fill();
                    }
                    
                    // Path Highlight
                    if (isPathPreview) {
                        ctx.fillStyle = 'rgba(251, 191, 36, 0.4)'; // Amber glow
                        ctx.fill();
                    }

                    if (dimension === Dimension.UPSIDE_DOWN) {
                        ctx.fillStyle = 'rgba(20, 0, 40, 0.4)';
                        ctx.fill();
                    }
                    ctx.restore();
                } else {
                    ctx.fillStyle = TERRAIN_COLORS[cell.terrain] || '#333';
                    ctx.fill();
                }
                
                // Border
                ctx.strokeStyle = isPathPreview ? '#fbbf24' : 'rgba(0,0,0,0.2)';
                ctx.lineWidth = isPathPreview ? 2 : 1;
                ctx.stroke();

                // 2. OVERLAYS (Only if not too dark)
                const overlayData = ASSETS.OVERLAYS[cell.terrain];
                if (overlayData) {
                    const overlayUrl = Array.isArray(overlayData) ? overlayData[Math.abs((cell.q * 3 + cell.r) % overlayData.length)] : overlayData;
                    const overlayImg = images[overlayUrl];
                    
                    if (overlayImg && overlayImg.complete && overlayImg.naturalWidth > 0) {
                        const size = HEX_SIZE * 2.2;
                        const opacity = (!isVisible && !mapData) ? 0.4 : 1;
                        ctx.globalAlpha = opacity;
                        ctx.drawImage(overlayImg, screenX - size/2, screenY - size * 0.7, size, size);
                        ctx.globalAlpha = 1;
                    }
                }

                // 3. POIs & ICONS
                if (cell.poiType) {
                    let iconChar = '';
                    if (cell.poiType === 'TEMPLE') {
                        const templeImg = images[ASSETS.TEMPLE_ICON];
                        if (templeImg && templeImg.complete && templeImg.naturalWidth > 0) {
                            ctx.drawImage(templeImg, screenX - HEX_SIZE, screenY - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2);
                        } else iconChar = '⛩️';
                    } else if (cell.poiType === 'SHOP') iconChar = '💰';
                    else if (cell.poiType === 'INN') iconChar = '🍺';
                    else if (cell.poiType === 'EXIT') iconChar = '🚪';
                    
                    if (iconChar) {
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        ctx.beginPath();
                        ctx.arc(screenX, screenY, HEX_SIZE/2.5, 0, Math.PI*2);
                        ctx.fill();
                        ctx.fillStyle = '#fff';
                        ctx.font = '16px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(iconChar, screenX, screenY);
                    }
                }
                
                // Portal
                if (cell.hasPortal) {
                    const portalImg = images[ASSETS.PORTAL_ICON];
                    if (portalImg && portalImg.complete && portalImg.naturalWidth > 0) {
                        const pulse = 1 + Math.sin(Date.now() / 200) * 0.1;
                        const size = HEX_SIZE * 1.5 * pulse;
                        ctx.drawImage(portalImg, screenX - size/2, screenY - size/2, size, size);
                    } else {
                        ctx.fillStyle = '#a855f7';
                        ctx.beginPath();
                        ctx.arc(screenX, screenY, HEX_SIZE/3, 0, Math.PI*2);
                        ctx.fill();
                        ctx.strokeStyle = '#fff';
                        ctx.stroke();
                    }
                }

            } else {
                // UNEXPLORED
                ctx.fillStyle = '#020617';
                ctx.fill();
                ctx.strokeStyle = '#1e293b';
                ctx.stroke();
            }
        };

        // Render Map Grid
        if (mapData) {
            mapData.forEach(cell => drawTile(cell, hoverPath.some(h => h.q === cell.q && h.r === cell.r)));
        } else {
            const topLeft = pixelToAxial(startX, startY);
            const bottomRight = pixelToAxial(endX, endY);
            const qMin = Math.min(topLeft.q, bottomRight.q) - 2;
            const qMax = Math.max(topLeft.q, bottomRight.q) + 2;
            const rMin = Math.min(topLeft.r, bottomRight.r) - 2;
            const rMax = Math.max(topLeft.r, bottomRight.r) + 2;

            for (let q = qMin; q <= qMax; q++) {
                for (let r = rMin; r <= rMax; r++) {
                    const key = `${q},${r}`;
                    const isExplored = exploredTiles[dimension]?.has(key);
                    const isHoveredPath = hoverPath.some(h => h.q === q && h.r === r);
                    
                    let cell: HexCell;
                    if (isExplored) {
                        cell = { ...WorldGenerator.getTile(q, r, dimension), isExplored: true };
                    } else {
                        // Even unexplored path should be visible-ish if dragging/pathfinding? usually no.
                        // But we can show cursor preview.
                        cell = { q, r, terrain: TerrainType.GRASS, weather: WeatherType.NONE, isExplored: false, isVisible: false };
                    }
                    drawTile(cell, isHoveredPath);
                }
            }
        }

        // 4. DRAW ENEMIES (Re-connected)
        activeOverworldEnemies.forEach(enemy => {
            if (enemy.dimension !== dimension) return;
            
            // Only draw enemies if player has Line of Sight (approximated by Tile Visibility here)
            if (!isTileVisible(enemy.q, enemy.r)) return;

            const { x, y } = hexToPixel(enemy.q, enemy.r);
            const screenX = x + offset.x;
            const screenY = y + offset.y;

            // Sprite or Fallback
            const enemyImg = images[enemy.sprite];
            if (enemyImg && enemyImg.complete && enemyImg.naturalWidth > 0) {
                const size = HEX_SIZE * 1.5;
                // Bobbing animation
                const bob = Math.sin(Date.now() / 300) * 5;
                ctx.drawImage(enemyImg, screenX - size/2, screenY - size * 0.8 + bob, size, size);
            } else {
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(screenX, screenY, HEX_SIZE * 0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = '12px sans-serif';
                ctx.fillText('💀', screenX, screenY);
            }
            
            // Health Bar (Mini)
            ctx.fillStyle = 'black';
            ctx.fillRect(screenX - 10, screenY - 30, 20, 4);
            ctx.fillStyle = 'red';
            ctx.fillRect(screenX - 10, screenY - 30, 20, 4);
        });

        // 5. DRAW PLAYER
        const { x: px, y: py } = hexToPixel(playerPos.x, playerPos.y);
        const screenPx = px + offset.x;
        const screenPy = py + offset.y;

        const gradient = ctx.createRadialGradient(screenPx, screenPy, HEX_SIZE * 0.2, screenPx, screenPy, HEX_SIZE * 0.8);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenPx, screenPy, HEX_SIZE * 0.8, 0, Math.PI * 2);
        ctx.fill();

        const playerImg = images[ASSETS.UNITS.PLAYER];
        if (playerImg && playerImg.complete && playerImg.naturalWidth > 0) {
            const size = HEX_SIZE * 1.2;
            const bounce = Math.abs(Math.sin(Date.now() / 200)) * 3;
            ctx.drawImage(playerImg, screenPx - size/2, screenPy - size/2 - 5 - bounce, size, size);
        } else {
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(screenPx, screenPy, HEX_SIZE * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'white';
            ctx.stroke();
        }

    }, [offset, mapData, playerPos, dimension, exploredTiles, activeOverworldEnemies, hoverPath, images, party]);

    // --- INTERACTION HANDLERS ---

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        } else {
            // PATHFINDING PREVIEW (Re-connected)
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left - offset.x;
                const y = e.clientY - rect.top - offset.y;
                const { q, r } = pixelToAxial(x, y);

                // Debounce pathfinding calculation
                if (q !== lastHoverRef.current.q || r !== lastHoverRef.current.r) {
                    lastHoverRef.current = { q, r };
                    
                    // Update Hovered Cell Data for Tooltip
                    if (mapData) {
                        setHoveredCell(mapData.find(c => c.q === q && c.r === r) || null);
                    } else {
                        // Check if explored
                        const key = `${q},${r}`;
                        const isExplored = exploredTiles[dimension]?.has(key);
                        if (isExplored) {
                            setHoveredCell(WorldGenerator.getTile(q, r, dimension));
                        } else {
                            setHoveredCell(null);
                        }
                    }

                    // Don't calc path to self
                    if (q === playerPos.x && r === playerPos.y) {
                        setHoverPath([]);
                        return;
                    }

                    // Check if tile is valid/explored
                    const key = `${q},${r}`;
                    const isExplored = mapData || exploredTiles[dimension]?.has(key);
                    
                    if (isExplored) {
                        let path: any[] | null = null;
                        if (mapData) {
                            path = findPath({q: playerPos.x, r: playerPos.y}, {q, r}, mapData);
                        } else {
                            path = findPath({q: playerPos.x, r: playerPos.y}, {q, r}, undefined, (qx, rx) => WorldGenerator.getTile(qx, rx, dimension));
                        }
                        
                        if (path) setHoverPath(path);
                        else setHoverPath([]);
                    } else {
                        setHoverPath([]);
                    }
                }
            }
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleClick = (e: React.MouseEvent) => {
        if (isDragging) return;
        
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left - offset.x;
        const y = e.clientY - rect.top - offset.y;
        
        const { q, r } = pixelToAxial(x, y);
        onMove(q, r);
    };

    const currentWeather = useMemo(() => {
        if (mapData) return WeatherType.NONE;
        return WorldGenerator.getTile(playerPos.x, playerPos.y, dimension).weather;
    }, [playerPos, dimension, mapData]);

    return (
        <div ref={containerRef} className="fixed inset-0 w-full h-full bg-black select-none z-0">
            <canvas 
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { handleMouseUp(); setHoverPath([]); setHoveredCell(null); }}
                onClick={handleClick}
                className="block cursor-crosshair touch-none w-full h-full"
            />
            <WeatherOverlay type={currentWeather} />
            
            {/* HUD / Tooltips */}
            <div className="absolute top-4 left-4 pointer-events-none z-10">
                <div className="text-white text-xs font-mono bg-black/50 px-2 py-1 rounded">
                    Pos: {playerPos.x}, {playerPos.y}
                </div>
            </div>

            {/* Terrain Info Tooltip (Re-connected) */}
            {hoveredCell && (
                <div className="absolute bottom-32 right-4 bg-slate-900/90 border border-slate-700 p-3 rounded-lg text-xs text-slate-200 z-10 shadow-lg pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="font-bold text-amber-400 uppercase tracking-widest mb-1">{hoveredCell.terrain}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                        <span className="text-slate-500">Weather:</span> <span>{hoveredCell.weather}</span>
                        <span className="text-slate-500">Coords:</span> <span>{hoveredCell.q}, {hoveredCell.r}</span>
                        {hoveredCell.poiType && (
                            <>
                                <span className="text-slate-500">POI:</span> <span className="text-purple-400 font-bold">{hoveredCell.poiType}</span>
                            </>
                        )}
                        {hoveredCell.hasPortal && (
                            <div className="col-span-2 text-blue-400 font-bold mt-1">🌀 Portal Detected</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
