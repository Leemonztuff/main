
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
        
        // 2. Dynamic Sprites (Enemies & Player)
        additionalSprites.forEach(url => {
            if (url) urlsToLoad.add(url);
        });

        const loadedImages: Record<string, HTMLImageElement> = {};
        let loadedCount = 0;

        urlsToLoad.forEach(url => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Allow external CDN usage
            img.src = url;
            img.onload = () => {
                loadedCount++;
                setVersion(v => v + 1); 
            };
            img.onerror = () => {
                console.warn(`Failed to load sprite: ${url}`);
            };
            loadedImages[url] = img;
        });

        setImages(loadedImages);
    }, [JSON.stringify(additionalSprites)]); // Reload if sprite list changes

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
    
    // Viewport State
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1); // New Zoom State
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hoverPath, setHoverPath] = useState<HexCell[]>([]);
    const [hoveredCell, setHoveredCell] = useState<HexCell | null>(null);
    const lastHoverRef = useRef({ q: -999, r: -999 });
    
    // Touch state
    const touchStartRef = useRef<{x: number, y: number} | null>(null);

    // Calculate required sprites including enemies AND THE PLAYER LEADER
    const requiredSprites = useMemo(() => {
        const list = activeOverworldEnemies
            .filter(e => e.dimension === dimension)
            .map(e => e.sprite);
        
        // Add Player Leader Sprite to ensure it loads
        if (party && party[0]?.visual?.spriteUrl) {
            list.push(party[0].visual.spriteUrl);
        } else {
            list.push(ASSETS.UNITS.PLAYER);
        }
        
        return list;
    }, [activeOverworldEnemies, dimension, party]);

    const images = useSpriteLoader(requiredSprites);

    const centerOnPlayer = useCallback(() => {
        if (!containerRef.current) return;
        const centerPixel = hexToPixel(playerPos.x, playerPos.y);
        const centerX = containerRef.current.clientWidth / 2;
        const centerY = containerRef.current.clientHeight / 2;
        
        // Apply zoom to centering calculation:
        // We want PlayerWorldPos + Offset = CenterScreen / Zoom
        // So Offset = (CenterScreen / Zoom) - PlayerWorldPos
        setOffset({ 
            x: (centerX / zoom) - centerPixel.x, 
            y: (centerY / zoom) - centerPixel.y 
        });
    }, [playerPos, zoom]);

    // Handle Resize (High DPI + Desktop Zoom Logic)
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && containerRef.current) {
                const canvas = canvasRef.current;
                const container = containerRef.current;
                
                // 1. Detect Desktop vs Mobile for Auto-Zoom
                const isDesktop = container.clientWidth > 1024;
                const newZoom = isDesktop ? 1.5 : 1.0;
                setZoom(newZoom);

                // 2. Setup DPI scaling
                const dpr = window.devicePixelRatio || 1;
                canvas.width = container.clientWidth * dpr;
                canvas.height = container.clientHeight * dpr;
                canvas.style.width = `${container.clientWidth}px`;
                canvas.style.height = `${container.clientHeight}px`;
                
                // We'll call centerOnPlayer in the dependency effect below
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Init
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Recenter when player moves or zoom changes
    useEffect(() => {
        centerOnPlayer();
    }, [playerPos.x, playerPos.y, zoom, centerOnPlayer]);

    // --- DRAW LOOP ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        // SCALE CONTEXT FOR HIGH DPI + GAME ZOOM
        const dpr = window.devicePixelRatio || 1;
        ctx.resetTransform();
        // Combine Device Pixel Ratio with our Game Zoom level
        ctx.scale(dpr * zoom, dpr * zoom);
        
        // CRITICAL: DISABLE SMOOTHING FOR PIXEL ART
        ctx.imageSmoothingEnabled = false;

        // Calculate logical width/height (in game world pixels)
        const logicalWidth = canvas.width / (dpr * zoom);
        const logicalHeight = canvas.height / (dpr * zoom);

        // Background
        ctx.fillStyle = dimension === Dimension.UPSIDE_DOWN ? '#0f0518' : '#0f172a';
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);

        const startX = -offset.x - HEX_SIZE * 2;
        const startY = -offset.y - HEX_SIZE * 2;
        const endX = startX + logicalWidth + HEX_SIZE * 4;
        const endY = startY + logicalHeight + HEX_SIZE * 4;

        // Helper to check if a tile is currently visible (Line of Sight / Fog of War)
        const visionRange = calculateVisionRange(party[0]?.stats.attributes.WIS || 10, party[0]?.stats.corruption || 0);
        const isTileVisible = (q: number, r: number) => {
            if (mapData) return true; // Town is fully visible usually
            const dist = (Math.abs(q - playerPos.x) + Math.abs(q + r - playerPos.x - playerPos.y) + Math.abs(r - playerPos.y)) / 2;
            return dist <= visionRange;
        };

        const drawTile = (cell: HexCell, isPathPreview = false) => {
            const { x, y } = hexToPixel(cell.q, cell.r);
            
            // INTEGER SNAPPING: Round to nearest pixel to avoid blurring
            const screenX = Math.floor(x + offset.x);
            const screenY = Math.floor(y + offset.y);

            // Culling with Zoom factored in implicitly via logicalWidth/Height
            if (screenX < -HEX_SIZE * 2 || screenX > logicalWidth + HEX_SIZE * 2 || 
                screenY < -HEX_SIZE * 2 || screenY > logicalHeight + HEX_SIZE * 2) return;

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
                    
                    if (!isVisible && !mapData) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                        ctx.fill();
                    }
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
                    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                
                // Border
                ctx.strokeStyle = isPathPreview ? '#fbbf24' : 'rgba(0,0,0,0.2)';
                ctx.lineWidth = isPathPreview ? 2 : 1;
                ctx.stroke();

                // 2. OVERLAYS
                const overlayData = ASSETS.OVERLAYS[cell.terrain];
                if (overlayData) {
                    const overlayUrl = Array.isArray(overlayData) ? overlayData[Math.abs((cell.q * 3 + cell.r) % overlayData.length)] : overlayData;
                    const overlayImg = images[overlayUrl];
                    
                    if (overlayImg && overlayImg.complete && overlayImg.naturalWidth > 0) {
                        const size = HEX_SIZE * 2.2;
                        const opacity = (!isVisible && !mapData) ? 0.4 : 1;
                        ctx.globalAlpha = opacity;
                        ctx.drawImage(overlayImg, Math.floor(screenX - size/2), Math.floor(screenY - size * 0.7), size, size);
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
                
                if (cell.hasPortal) {
                    const portalImg = images[ASSETS.PORTAL_ICON];
                    if (portalImg && portalImg.complete && portalImg.naturalWidth > 0) {
                        const pulse = 1 + Math.sin(Date.now() / 200) * 0.1;
                        const size = HEX_SIZE * 1.5 * pulse;
                        ctx.drawImage(portalImg, Math.floor(screenX - size/2), Math.floor(screenY - size/2), size, size);
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
                        cell = { q, r, terrain: TerrainType.GRASS, weather: WeatherType.NONE, isExplored: false, isVisible: false };
                    }
                    drawTile(cell, isHoveredPath);
                }
            }
        }

        // 4. DRAW ENEMIES
        activeOverworldEnemies.forEach(enemy => {
            if (enemy.dimension !== dimension) return;
            if (!isTileVisible(enemy.q, enemy.r)) return;

            const { x, y } = hexToPixel(enemy.q, enemy.r);
            const screenX = Math.floor(x + offset.x);
            const screenY = Math.floor(y + offset.y);

            // Sprite or Fallback
            const enemyImg = images[enemy.sprite];
            if (enemyImg && enemyImg.complete && enemyImg.naturalWidth > 0) {
                // SCALED UP ENEMY (1.8x)
                const size = HEX_SIZE * 1.8;
                const bob = Math.sin(Date.now() / 300) * 5;
                // Anchor Y so feet are at tile center (approx)
                ctx.drawImage(enemyImg, Math.floor(screenX - size/2), Math.floor(screenY - size * 0.8 + bob), size, size);
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

        // 5. DRAW PLAYER (DYNAMIC LEADER SPRITE)
        const { x: px, y: py } = hexToPixel(playerPos.x, playerPos.y);
        const screenPx = Math.floor(px + offset.x);
        const screenPy = Math.floor(py + offset.y);

        // Position Indicator Ring
        const gradient = ctx.createRadialGradient(screenPx, screenPy, HEX_SIZE * 0.2, screenPx, screenPy, HEX_SIZE * 0.8);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenPx, screenPy, HEX_SIZE * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Use the leader's specific sprite URL
        const playerSpriteUrl = party[0]?.visual?.spriteUrl || ASSETS.UNITS.PLAYER;
        const playerImg = images[playerSpriteUrl];

        if (playerImg && playerImg.complete && playerImg.naturalWidth > 0) {
            // SCALED UP PLAYER (2.4x) - HEROIC SCALE
            const size = HEX_SIZE * 2.4;
            const bounce = Math.abs(Math.sin(Date.now() / 200)) * 3;
            
            // Draw Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(screenPx, screenPy, size/4, size/8, 0, 0, Math.PI*2);
            ctx.fill();

            // Draw Sprite
            // Anchor Logic: 
            // X: Center (screenPx - size/2)
            // Y: Move up so feet roughly align with tile center (screenPy - size * 0.75)
            // This allows head to overlap tile above for depth
            ctx.drawImage(playerImg, Math.floor(screenPx - size/2), Math.floor(screenPy - size * 0.75 - bounce), size, size);
            
        } else {
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(screenPx, screenPy, HEX_SIZE * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'white';
            ctx.stroke();
        }

    }, [offset, zoom, mapData, playerPos, dimension, exploredTiles, activeOverworldEnemies, hoverPath, images, party]);

    // --- INTERACTION HANDLERS (MOUSE) ---

    // Helper to get World Coordinates taking Zoom into account
    const getWorldMouse = (clientX: number, clientY: number) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        // Mouse relative to canvas top-left
        const rawX = clientX - rect.left;
        const rawY = clientY - rect.top;
        
        // Convert to Zoomed World Space
        const worldX = (rawX / zoom) - offset.x;
        const worldY = (rawY / zoom) - offset.y;
        
        return { x: worldX, y: worldY };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        // Store the raw screen position for drag delta calculation
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            // Drag moves the camera, so we change offset.
            // Delta in screen pixels needs to be divided by zoom to get delta in world pixels
            const dx = (e.clientX - dragStart.x) / zoom;
            const dy = (e.clientY - dragStart.y) / zoom;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setDragStart({ x: e.clientX, y: e.clientY });
        } else {
            // PATHFINDING PREVIEW
            const { x, y } = getWorldMouse(e.clientX, e.clientY);
            const { q, r } = pixelToAxial(x, y);

            if (q !== lastHoverRef.current.q || r !== lastHoverRef.current.r) {
                lastHoverRef.current = { q, r };
                
                if (mapData) {
                    setHoveredCell(mapData.find(c => c.q === q && c.r === r) || null);
                } else {
                    const key = `${q},${r}`;
                    const isExplored = exploredTiles[dimension]?.has(key);
                    if (isExplored) {
                        setHoveredCell(WorldGenerator.getTile(q, r, dimension));
                    } else {
                        setHoveredCell(null);
                    }
                }

                if (q === playerPos.x && r === playerPos.y) {
                    setHoverPath([]);
                    return;
                }

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
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleClick = (e: React.MouseEvent) => {
        if (isDragging) return;
        
        const { x, y } = getWorldMouse(e.clientX, e.clientY);
        const { q, r } = pixelToAxial(x, y);
        onMove(q, r);
    };

    // --- INTERACTION HANDLERS (TOUCH - MOBILE SUPPORT) ---
    
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchStartRef.current = { x: touch.clientX, y: touch.clientY };
            setIsDragging(true);
            setDragStart({ x: touch.clientX, y: touch.clientY });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && isDragging) {
            const touch = e.touches[0];
            const dx = (touch.clientX - dragStart.x) / zoom;
            const dy = (touch.clientY - dragStart.y) / zoom;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setDragStart({ x: touch.clientX, y: touch.clientY });
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        setIsDragging(false);
        
        if (e.changedTouches.length === 1 && touchStartRef.current) {
            const touch = e.changedTouches[0];
            // If movement is very small, treat as Click/Tap
            const dist = Math.abs(touch.clientX - touchStartRef.current.x) + Math.abs(touch.clientY - touchStartRef.current.y);
            
            if (dist < 10) { // Tolerance for "tap"
                const { x, y } = getWorldMouse(touch.clientX, touch.clientY);
                const { q, r } = pixelToAxial(x, y);
                
                // On mobile, first tap shows preview/path, second tap confirms move
                const key = `${q},${r}`;
                const isExplored = mapData || exploredTiles[dimension]?.has(key);
                
                if (isExplored) {
                    setHoveredCell(mapData ? mapData.find(c => c.q === q && c.r === r) || null : WorldGenerator.getTile(q, r, dimension));
                    
                    // Calculate path for preview
                    let path: any[] | null = null;
                    if (mapData) path = findPath({q: playerPos.x, r: playerPos.y}, {q, r}, mapData);
                    else path = findPath({q: playerPos.x, r: playerPos.y}, {q, r}, undefined, (qx, rx) => WorldGenerator.getTile(qx, rx, dimension));
                    
                    if (hoverPath.length > 0 && hoverPath[hoverPath.length-1].q === q && hoverPath[hoverPath.length-1].r === r) {
                        // Confirmed move
                        onMove(q, r);
                        setHoverPath([]);
                    } else {
                        // Show preview
                        setHoverPath(path || []);
                    }
                }
            }
        }
        touchStartRef.current = null;
    };

    const currentWeather = useMemo(() => {
        if (mapData) return WeatherType.NONE;
        return WorldGenerator.getTile(playerPos.x, playerPos.y, dimension).weather;
    }, [playerPos, dimension, mapData]);

    return (
        <div ref={containerRef} className="fixed inset-0 w-full h-full bg-black select-none z-0 overflow-hidden touch-none">
            <canvas 
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { handleMouseUp(); setHoverPath([]); setHoveredCell(null); }}
                onClick={handleClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="block cursor-crosshair touch-none w-full h-full"
            />
            <WeatherOverlay type={currentWeather} />
            
            {/* HUD / Tooltips */}
            <div className="absolute top-4 left-4 pointer-events-none z-10">
                <div className="text-white text-xs font-mono bg-black/50 px-2 py-1 rounded">
                    Pos: {playerPos.x}, {playerPos.y}
                </div>
            </div>

            {/* Terrain Info Tooltip */}
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
