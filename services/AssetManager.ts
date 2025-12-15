
import { ASSETS } from '../constants';
import { TerrainType, Entity } from '../types';

/**
 * Service to centralize asset logic.
 * Determines which textures are needed for a given battle context.
 */
export const AssetManager = {
    /**
     * Returns a deduplicated list of all texture URLs needed for the terrain blocks.
     */
    getBiomeBlockTextures: (terrain: TerrainType): string[] => {
        const textures = new Set<string>();

        // Safely access block textures
        const blockTextures = ASSETS?.BLOCK_TEXTURES || {};

        // Always load defaults to prevent missing texture crashes
        if (blockTextures[TerrainType.GRASS]) textures.add(blockTextures[TerrainType.GRASS]!);
        if (blockTextures[TerrainType.MOUNTAIN]) textures.add(blockTextures[TerrainType.MOUNTAIN]!);
        
        // Load specific biome texture
        const specific = blockTextures[terrain];
        if (specific) textures.add(specific);

        // Load common structural textures
        if (blockTextures[TerrainType.DIRT_ROAD]) textures.add(blockTextures[TerrainType.DIRT_ROAD]!);
        if (blockTextures[TerrainType.COBBLESTONE]) textures.add(blockTextures[TerrainType.COBBLESTONE]!);
        if (blockTextures[TerrainType.STONE_FLOOR]) textures.add(blockTextures[TerrainType.STONE_FLOOR]!);
        if (blockTextures[TerrainType.CASTLE]) textures.add(blockTextures[TerrainType.CASTLE]!);
        
        // Specific Biome Logic
        if (terrain === TerrainType.SWAMP) {
            if (blockTextures[TerrainType.WATER]) textures.add(blockTextures[TerrainType.WATER]!);
        }

        return Array.from(textures).filter(t => t && typeof t === 'string' && t.length > 5);
    },

    /**
     * Returns a list of decoration sprites needed for the biome.
     */
    getBiomeDecorations: (terrain: TerrainType): string[] => {
        const decos = new Set<string>();
        
        if (ASSETS?.DECORATIONS) {
            // Add all base decorations to be safe
            Object.values(ASSETS.DECORATIONS).forEach(url => {
                if(url) decos.add(url);
            });
        }

        return Array.from(decos).filter(t => t && typeof t === 'string');
    },

    /**
     * Returns a list of sprite URLs for all entities currently in battle.
     */
    getEntitySprites: (entities: Entity[]): string[] => {
        const sprites = new Set<string>();
        if (entities) {
            entities.forEach(e => {
                // @ts-ignore
                if (e.visual?.spriteUrl) sprites.add(e.visual.spriteUrl);
            });
        }
        
        return Array.from(sprites).filter(t => t && typeof t === 'string');
    },

    /**
     * Combines all lists into one master list for the preloader.
     */
    getAllBattleAssets: (terrain: TerrainType, entities: Entity[]): string[] => {
        const blocks = AssetManager.getBiomeBlockTextures(terrain);
        const decos = AssetManager.getBiomeDecorations(terrain);
        const units = AssetManager.getEntitySprites(entities);
        
        const all = [...new Set([...blocks, ...decos, ...units])];
        // Final strict filter
        return all.filter(url => url && typeof url === 'string' && !url.includes('undefined') && !url.includes('null'));
    }
};
