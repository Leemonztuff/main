
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
const useSpriteLoader = () => {
    const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
    // We trigger a re-render when images load by updating a counter or state
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const urlsToLoad = new Set<string>();
        
        // 1. Collect Terrain Base
        Object.values(ASSETS.TERRAIN).forEach(url => urlsToLoad.add(url));
        
        // 2. Collect Overlays
        Object.values(ASSETS.OVERLAYS).forEach(val => {
            if (Array.isArray(val)) val.forEach(v => urlsToLoad.add(v));
            else urlsToLoad.add(val as string);
        });

        // 3. Collect Icons
        if (ASSETS.TEMPLE_ICON) urlsToLoad.add(ASSETS.TEMPLE_ICON);
        if (ASSETS.PORTAL_ICON) urlsToLoad.add(ASSETS.PORTAL_ICON);
        if (ASSETS.UNITS.PLAYER) urlsToLoad.add(ASSETS.UNITS.PLAYER);

        const loadedImages: Record<string, HTMLImageElement> = {};
        let loadedCount = 0;

        urlsToLoad.forEach(url => {
            const img = new Image();
            img.src = url;
            img.onload = () => {
                loadedCount++;
                setVersion(v => v + 1); // Trigger render update
            };
            loadedImages[url] = img;
        });

        setImages(loadedImages);
    }, []);

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
            bgColor = 'rgba(255, 255, 255, 0.1)';
            break;
        case WeatherType.ASH:
            bgColor = 'rgba(100, 50, 0, 0.2)';
            break;
        case WeatherType.FOG:
            bgColor = 'rgba(200, 200, 200, 0.2)';
            break;
        case WeatherType.RED_STORM:
            bgColor = 'rgba(150, 0, 0, 0.2)';
            break;
    }

    return (
        <div 
            style={{ 
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30,
                backgroundImage: bgImage, backgroundColor: bgColor, animation, opacity
            }} 
        />
    );
};

export const OverworldMap: React.FC<OverworldMapProps> = ({ mapData, playerPos, onMove, dimension }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { exploredTiles, gameState } = useGameStore();
    const images = useSpriteLoader();
    
    // Viewport State
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
        handleResize(); // Initial sizing
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Center on Player when position changes or map loads
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

    // Draw Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        // Clear Background
        ctx.fillStyle = dimension === Dimension.UPSIDE_DOWN ? '#0f0518' : '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const startX = -offset.x - HEX_SIZE * 2;
        const startY = -offset.y - HEX_SIZE * 2;
        const endX = startX + canvas.width + HEX_SIZE * 4;
        const endY = startY + canvas.height + HEX_SIZE * 4;

        const drawTile = (cell: HexCell) => {
            const { x, y } = hexToPixel(cell.q, cell.r);
            const screenX = x + offset.x;
            const screenY = y + offset.y;

            // Frustum Culling
            if (screenX < -HEX_SIZE * 2 || screenX > canvas.width + HEX_SIZE * 2 || 
                screenY < -HEX_SIZE * 2 || screenY > canvas.height + HEX_SIZE * 2) return;

            // 1. DEFINE HEX PATH
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = 2 * Math.PI / 6 * i;
                const hx = screenX + (HEX_SIZE + 1) * Math.cos(angle); // +1 to overlap gaps
                const hy = screenY + (HEX_SIZE + 1) * Math.sin(angle);
                if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
            }
            ctx.closePath();

            // 2. DRAW BASE TERRAIN
            if (cell.isExplored || mapData) { 
                const baseTextureUrl = ASSETS.TERRAIN[cell.terrain];
                const baseImg = images[baseTextureUrl];

                if (baseImg && baseImg.complete) {
                    ctx.save();
                    ctx.clip(); // Mask to hex shape
                    // Draw slightly larger to cover hex area fully
                    ctx.drawImage(baseImg, screenX - HEX_SIZE, screenY - HEX_SIZE * Math.sqrt(3)/2, HEX_SIZE * 2, HEX_SIZE * Math.sqrt(3));
                    
                    // Darken Upside Down world
                    if (dimension === Dimension.UPSIDE_DOWN) {
                        ctx.fillStyle = 'rgba(20, 0, 40, 0.4)';
                        ctx.fill();
                    }
                    ctx.restore();
                } else {
                    // Fallback Color
                    ctx.fillStyle = TERRAIN_COLORS[cell.terrain] || '#333';
                    ctx.fill();
                }
                
                // Hex Border
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // 3. DRAW OVERLAYS (Trees, Mountains) - No clipping, allows overlap 3D effect
                const overlayData = ASSETS.OVERLAYS[cell.terrain];
                if (overlayData) {
                    const overlayUrl = Array.isArray(overlayData) ? overlayData[Math.abs((cell.q * 3 + cell.r) % overlayData.length)] : overlayData;
                    const overlayImg = images[overlayUrl];
                    
                    if (overlayImg && overlayImg.complete) {
                        // Draw centered but shifted up slightly for pseudo-3D
                        const size = HEX_SIZE * 2.2;
                        ctx.drawImage(overlayImg, screenX - size/2, screenY - size * 0.7, size, size);
                    }
                }

                // 4. DRAW POIs (Castle, Village, Temple, Portal)
                if (cell.poiType) {
                    let iconChar = '?';
                    let iconColor = '#fbbf24';
                    
                    // Use Image icons if available
                    if (cell.poiType === 'TEMPLE') {
                        const templeImg = images[ASSETS.TEMPLE_ICON];
                        if (templeImg && templeImg.complete) {
                            ctx.drawImage(templeImg, screenX - HEX_SIZE, screenY - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2);
                        } else {
                            iconChar = '⛩️';
                        }
                    } else if (cell.poiType === 'CASTLE' || cell.poiType === 'VILLAGE') {
                        // Already handled by terrain/overlay usually, but add marker if generic
                        if (!overlayData) iconChar = '🏰';
                        else iconChar = ''; // Don't draw char if building sprite exists
                    } else {
                        if (cell.poiType === 'SHOP') iconChar = '💰';
                        if (cell.poiType === 'INN') iconChar = '🍺';
                        if (cell.poiType === 'EXIT') iconChar = '🚪';
                        
                        if (iconChar) {
                            ctx.fillStyle = 'rgba(0,0,0,0.5)';
                            ctx.beginPath();
                            ctx.arc(screenX, screenY, HEX_SIZE/2.5, 0, Math.PI*2);
                            ctx.fill();
                            
                            ctx.fillStyle = '#fff';
                            ctx.font = '14px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(iconChar, screenX, screenY);
                        }
                    }
                }
                
                // Portal Pulse
                if (cell.hasPortal) {
                    const portalImg = images[ASSETS.PORTAL_ICON];
                    if (portalImg && portalImg.complete) {
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
                
                // Enemies
                if (cell.hasEncounter) {
                    ctx.fillStyle = '#ef4444';
                    ctx.font = '16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.shadowColor = 'black';
                    ctx.shadowBlur = 4;
                    ctx.fillText('💀', screenX, screenY - HEX_SIZE/2);
                    ctx.shadowBlur = 0;
                }

            } else {
                // UNEXPLORED (Fog of War)
                ctx.fillStyle = '#020617'; // Very dark blue/black
                ctx.fill();
                ctx.strokeStyle = '#1e293b';
                ctx.stroke();
            }
        };

        if (mapData) {
            mapData.forEach(drawTile);
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
                    
                    let cell: HexCell;
                    if (isExplored) {
                        cell = { ...WorldGenerator.getTile(q, r, dimension), isExplored: true };
                    } else {
                        cell = { q, r, terrain: TerrainType.GRASS, weather: WeatherType.NONE, isExplored: false, isVisible: false };
                    }
                    drawTile(cell);
                }
            }
        }

        // Draw Player Token
        const { x: px, y: py } = hexToPixel(playerPos.x, playerPos.y);
        const screenPx = px + offset.x;
        const screenPy = py + offset.y;

        // Glow
        const gradient = ctx.createRadialGradient(screenPx, screenPy, HEX_SIZE * 0.2, screenPx, screenPy, HEX_SIZE * 0.8);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenPx, screenPy, HEX_SIZE * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        const playerImg = images[ASSETS.UNITS.PLAYER];
        if (playerImg && playerImg.complete) {
            const size = HEX_SIZE * 1.2;
            ctx.drawImage(playerImg, screenPx - size/2, screenPy - size/2 - 5, size, size);
        } else {
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(screenPx, screenPy, HEX_SIZE * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'white';
            ctx.stroke();
        }

    }, [offset, mapData, playerPos, dimension, exploredTiles, canvasRef.current?.width, canvasRef.current?.height, images]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
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
        <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black select-none">
            <canvas 
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleClick}
                className="block cursor-crosshair touch-none"
            />
            <WeatherOverlay type={currentWeather} />
            
            <div className="absolute top-4 left-4 pointer-events-none">
                <div className="text-white text-xs font-mono bg-black/50 px-2 py-1 rounded">
                    {playerPos.x}, {playerPos.y}
                </div>
            </div>
        </div>
    );
};
