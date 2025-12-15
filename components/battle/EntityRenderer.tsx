
import React from 'react';
import { BillboardUnit } from './BillboardUnit';

export const EntityRenderer = React.memo(({ entity, isCurrentTurn, isActivePlayer, onTileClick, onInspect, hasActed, hasMoved, isActing, actionType }: any) => {
    if (!entity || !entity.position) return null;

    const modelType = entity.visual?.modelType || 'billboard';

    // Lifted Y from 0.5 to 0.85 to prevent sprite feet sinking into voxel blocks
    const yPos = 0.85;

    switch (modelType) {
        case 'voxel':
            return (
                <BillboardUnit 
                    position={[entity.position.x, yPos, entity.position.y]} 
                    color={entity.visual?.color || '#fff'} 
                    spriteUrl={entity.visual?.spriteUrl} 
                    isCurrentTurn={isCurrentTurn} 
                    isActivePlayer={isActivePlayer}
                    hp={entity.stats?.hp || 1} 
                    maxHp={entity.stats?.maxHp || 1}
                    onUnitClick={onTileClick}
                    onUnitRightClick={() => onInspect(entity.id)}
                    hasActed={hasActed}
                    hasMoved={hasMoved}
                    isActing={isActing}
                    actionType={actionType}
                    characterClass={entity.stats?.class}
                    statusEffects={entity.stats?.statusEffects}
                    name={entity.name}
                    level={entity.stats?.level}
                />
            );
        case 'billboard':
        default:
            return (
                <BillboardUnit 
                    position={[entity.position.x, yPos, entity.position.y]} 
                    color={entity.visual?.color || '#fff'} 
                    spriteUrl={entity.visual?.spriteUrl} 
                    isCurrentTurn={isCurrentTurn} 
                    isActivePlayer={isActivePlayer}
                    hp={entity.stats?.hp || 1} 
                    maxHp={entity.stats?.maxHp || 1}
                    onUnitClick={onTileClick}
                    onUnitRightClick={() => onInspect(entity.id)}
                    hasActed={hasActed}
                    hasMoved={hasMoved}
                    isActing={isActing}
                    actionType={actionType}
                    characterClass={entity.stats?.class}
                    statusEffects={entity.stats?.statusEffects}
                    name={entity.name}
                    level={entity.stats?.level}
                />
            );
    }
});
