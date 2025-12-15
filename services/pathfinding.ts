
import { HexCell, BattleCell, CharacterClass, TerrainType } from '../types';
import { TERRAIN_MOVEMENT_COST } from '../constants';

const HEX_DIRECTIONS = [
    { dq: 1, dr: 0 }, { dq: 0, dr: 1 }, { dq: -1, dr: 1 },
    { dq: -1, dr: 0 }, { dq: 0, dr: -1 }, { dq: 1, dr: -1 }
];

const GRID_DIRECTIONS = [
    { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
    { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
];

const distHex = (a: {q:number, r:number}, b: {q:number, r:number}) => {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
};

const distGrid = (a: {x:number, y:number}, b: {x:number, y:number}) => {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
};

const getCell = (q: number, r: number, map?: HexCell[], generator?: (q: number, r: number) => HexCell): HexCell | null => {
    if (map) {
        return map.find(c => c.q === q && c.r === r) || null;
    }
    if (generator) {
        return generator(q, r);
    }
    return null;
};

export const findPath = (
    start: {q:number, r:number}, 
    end: {q:number, r:number}, 
    map?: HexCell[], 
    generator?: (q:number, r:number) => HexCell
): HexCell[] | null => {
    
    const MAX_ITERATIONS = 500; 

    const startCell = getCell(start.q, start.r, map, generator);
    if (!startCell) return null;

    const endCell = getCell(end.q, end.r, map, generator);
    if (!endCell || (TERRAIN_MOVEMENT_COST[endCell.terrain] || 1) >= 99) return null;

    const openSet: { cell: HexCell, f: number, g: number, parent?: any }[] = [];
    const closedSet = new Set<string>();

    openSet.push({ cell: startCell, f: 0, g: 0 });

    let iterations = 0;

    while (openSet.length > 0) {
        iterations++;
        if (iterations > MAX_ITERATIONS) return null; 

        let lowInd = 0;
        for(let i=0; i<openSet.length; i++) {
            if(openSet[i].f < openSet[lowInd].f) {
                lowInd = i;
            }
        }
        
        const current = openSet[lowInd];
        
        openSet[lowInd] = openSet[openSet.length - 1];
        openSet.pop();

        const currentKey = `${current.cell.q},${current.cell.r}`;

        if (current.cell.q === end.q && current.cell.r === end.r) {
            const path: HexCell[] = [];
            let curr = current;
            while (curr.parent) {
                path.push(curr.cell);
                curr = curr.parent;
            }
            return path.reverse();
        }

        closedSet.add(currentKey);

        if (generator && distHex(current.cell, end) > 20) continue;

        for (const dir of HEX_DIRECTIONS) {
            const nQ = current.cell.q + dir.dq;
            const nR = current.cell.r + dir.dr;
            const nKey = `${nQ},${nR}`;

            if (closedSet.has(nKey)) continue;

            const neighbor = getCell(nQ, nR, map, generator);
            if (!neighbor) continue;

            const cost = TERRAIN_MOVEMENT_COST[neighbor.terrain] || 1;
            if (cost >= 99) continue;

            const tentativeG = current.g + cost;
            const existingNode = openSet.find(n => n.cell.q === nQ && n.cell.r === nR);
            
            if (existingNode && tentativeG >= existingNode.g) continue;

            const heuristic = distHex({q: nQ, r: nR}, end);
            const f = tentativeG + heuristic;

            if (existingNode) {
                existingNode.g = tentativeG;
                existingNode.f = f;
                existingNode.parent = current;
            } else {
                openSet.push({ cell: neighbor, g: tentativeG, f, parent: current });
            }
        }
    }
    return null;
};

export const findBattlePath = (start: {x:number, y:number}, end: {x:number, y:number}, grid: BattleCell[]): BattleCell[] | null => {
    const mapIndex = new Map<string, BattleCell>();
    const len = grid.length;
    for(let i=0; i<len; i++) {
        const c = grid[i];
        mapIndex.set(`${c.x},${c.z}`, c);
    }

    if (!mapIndex.has(`${end.x},${end.y}`)) return null;
    const targetCell = mapIndex.get(`${end.x},${end.y}`);
    if (targetCell?.isObstacle) return null;

    const openSet: { cell: BattleCell, f: number, g: number, parent?: any }[] = [];
    const closedSet = new Set<string>();

    const startCell = mapIndex.get(`${start.x},${start.y}`);
    if (!startCell) return null;

    openSet.push({ cell: startCell, f: 0, g: 0 });

    while (openSet.length > 0) {
        let lowInd = 0;
        for(let i=0; i<openSet.length; i++) {
            if(openSet[i].f < openSet[lowInd].f) lowInd = i;
        }
        const current = openSet[lowInd];
        openSet[lowInd] = openSet[openSet.length - 1];
        openSet.pop();

        const currentKey = `${current.cell.x},${current.cell.z}`;

        if (current.cell.x === end.x && current.cell.z === end.y) {
            const path: BattleCell[] = [];
            let curr = current;
            while (curr.parent) {
                path.push(curr.cell);
                curr = curr.parent;
            }
            return path.reverse();
        }

        closedSet.add(currentKey);

        for (const dir of GRID_DIRECTIONS) {
            const nX = current.cell.x + dir.dx;
            const nY = current.cell.z + dir.dy;
            const nKey = `${nX},${nY}`;

            if (closedSet.has(nKey)) continue;

            const neighbor = mapIndex.get(nKey);
            if (!neighbor) continue;

            if (neighbor.isObstacle) continue;
            
            const heightDiff = (neighbor.offsetY + neighbor.height) - (current.cell.offsetY + current.cell.height);
            if (heightDiff > 1.2) continue; 

            const isDiagonal = dir.dx !== 0 && dir.dy !== 0;
            const cost = isDiagonal ? 1.4 : 1;
            const tentativeG = current.g + cost;
            
            const existingNode = openSet.find(n => n.cell.x === nX && n.cell.z === nY);
            if (existingNode && tentativeG >= existingNode.g) continue;

            const heuristic = distGrid({x: nX, y: nY}, end);
            const newNode = { cell: neighbor, g: tentativeG, f: tentativeG + heuristic, parent: current };

            if (existingNode) {
                existingNode.g = tentativeG;
                existingNode.f = tentativeG + heuristic;
                existingNode.parent = current;
            } else {
                openSet.push(newNode);
            }
        }
    }
    return null;
}

/**
 * Dijkstra for reachable tiles
 */
export const getReachableTiles = (start: {x:number, y:number}, maxMovement: number, grid: BattleCell[], occupiedPositions: Set<string>, unitClass?: CharacterClass): {x:number, y:number}[] => {
    const mapIndex = new Map<string, BattleCell>();
    const len = grid.length;
    for(let i=0; i<len; i++) {
        const c = grid[i];
        mapIndex.set(`${c.x},${c.z}`, c);
    }

    const distances = new Map<string, number>();
    const queue: {x: number, y: number, dist: number}[] = [{ x: start.x, y: start.y, dist: 0 }];
    const reachable: {x: number, y: number}[] = [];

    distances.set(`${start.x},${start.y}`, 0);

    // Ranger Trait: Natural Explorer (Forests are not difficult terrain)
    const isRanger = unitClass === CharacterClass.RANGER;

    while(queue.length > 0) {
        queue.sort((a,b) => a.dist - b.dist);
        const current = queue.shift()!;
        
        if (current.dist > 0) {
            reachable.push({ x: current.x, y: current.y });
        }

        const currentCell = mapIndex.get(`${current.x},${current.y}`);
        if (!currentCell) continue; 

        for (const dir of GRID_DIRECTIONS) {
            const nX = current.x + dir.dx;
            const nY = current.y + dir.dy;
            const nKey = `${nX},${nY}`;
            
            const neighbor = mapIndex.get(nKey);
            if (!neighbor) continue;

            if (neighbor.isObstacle) continue;
            if (occupiedPositions.has(nKey)) continue;

            const heightDiff = (neighbor.offsetY + neighbor.height) - (currentCell.offsetY + currentCell.height);
            if (heightDiff > 1.2) continue; 

            const isDiagonal = dir.dx !== 0 && dir.dy !== 0;
            
            let baseCost = neighbor.movementCost || 1;
            
            // Ranger: Ignore difficult terrain in forests/jungle (cost > 1 becomes 1)
            if (isRanger && (neighbor.textureUrl.includes('forest') || neighbor.textureUrl.includes('grass')) && baseCost > 1) {
                baseCost = 1;
            }

            const moveCost = isDiagonal ? baseCost * 1.4 : baseCost;
            
            const newDist = current.dist + moveCost;

            if (newDist <= maxMovement) {
                if (!distances.has(nKey) || newDist < distances.get(nKey)!) {
                    distances.set(nKey, newDist);
                    queue.push({ x: nX, y: nY, dist: newDist });
                }
            }
        }
    }
    return reachable;
};
