import type { 
  Ship, Enemy, Die, CabinType, DamageRange, SimulationMetrics, 
  GameConfig, AllocationResult
} from '../types';
import { getAllocations, calculateCabinEffect } from './battle';
import { getTotalPoints, calculateEnergyCost, getCriticalCount } from './dice';

function calculateDamageRange(
  baseDamage: number,
  attackerCritRate: number,
  defenderEvasion: number,
  defenderDefense: number,
  defenderShield: number,
  config: GameConfig,
  guaranteedCrit: boolean = false,
  guaranteedNoCrit: boolean = false
): DamageRange {
  const missChance = defenderEvasion;
  const hitChance = 1 - missChance;
  
  let critChance: number;
  if (guaranteedCrit) {
    critChance = 1;
  } else if (guaranteedNoCrit) {
    critChance = 0;
  } else {
    critChance = attackerCritRate * hitChance;
  }
  
  const normalHitChance = hitChance - critChance;
  
  const baseDamageAfterDefense = baseDamage * (1 - defenderDefense);
  const critDamageAfterDefense = baseDamageAfterDefense * config.critMultiplier;
  
  const shieldAbsorptionRate = config.shieldAbsorptionRate;
  const maxShieldAbsorption = Math.min(defenderShield, baseDamageAfterDefense * shieldAbsorptionRate);
  
  const normalDamageMin = Math.max(1, Math.floor(baseDamageAfterDefense - maxShieldAbsorption));
  const normalDamageMax = Math.max(1, Math.floor(baseDamageAfterDefense));
  
  const critDamageMin = Math.max(1, Math.floor(critDamageAfterDefense - maxShieldAbsorption));
  const critDamageMax = Math.max(1, Math.floor(critDamageAfterDefense));
  
  const minDamage = missChance > 0 ? 0 : normalDamageMin;
  const maxDamage = critChance > 0 ? critDamageMax : normalDamageMax;
  
  const expectedDamage = 
    (missChance * 0) +
    (normalHitChance * ((normalDamageMin + normalDamageMax) / 2)) +
    (critChance * ((critDamageMin + critDamageMax) / 2));
  
  return {
    min: Math.floor(minDamage),
    max: Math.floor(maxDamage),
    expected: Math.floor(expectedDamage),
    critChance,
    missChance,
  };
}

function calculateHealRange(baseHeal: number, maxHp: number, currentHp: number): DamageRange {
  const actualHeal = Math.min(baseHeal, maxHp - currentHp);
  return {
    min: 0,
    max: actualHeal,
    expected: actualHeal,
    critChance: 0,
    missChance: 0,
  };
}

function calculateShieldRange(baseShield: number, maxShield: number, currentShield: number): DamageRange {
  const actualShield = Math.min(baseShield, maxShield - currentShield);
  return {
    min: 0,
    max: actualShield,
    expected: actualShield,
    critChance: 0,
    missChance: 0,
  };
}

function calculateEnemyDamageRange(
  enemy: Enemy,
  player: Ship,
  playerEvasionBonus: number,
  config: GameConfig
): DamageRange {
  const intent = enemy.intent;
  let baseDamage = 0;
  let guaranteedCrit = false;
  
  switch (intent.type) {
    case 'attack':
    case 'charge':
      baseDamage = intent.value;
      break;
    case 'special': {
      const expectedAbilityName = intent.description.replace('准备释放 ', '');
      const specialAbility = enemy.abilities.find(
        a => a.name === expectedAbilityName && a.currentCooldown === 0
      );
      if (specialAbility) {
        baseDamage = specialAbility.damage || 0;
        guaranteedCrit = specialAbility.effect === 'crit_guaranteed';
      }
      break;
    }
    case 'defend':
    case 'repair':
      return {
        min: 0,
        max: 0,
        expected: 0,
        critChance: 0,
        missChance: 0,
      };
  }
  
  const variance = config.enemyDamageVariance;
  const minBaseDamage = Math.floor(baseDamage * (1 - variance));
  const maxBaseDamage = Math.floor(baseDamage * (1 + variance));
  
  const playerEffectiveEvasion = Math.min(0.8, player.evasion + playerEvasionBonus);
  
  const missChance = playerEffectiveEvasion;
  const hitChance = 1 - missChance;
  
  const critRate = guaranteedCrit ? 1 : 0.1;
  const critChance = critRate * hitChance;
  const normalHitChance = hitChance - critChance;
  
  const minAfterDefense = minBaseDamage * (1 - player.defense);
  const maxAfterDefense = maxBaseDamage * (1 - player.defense);
  const critMinAfterDefense = minAfterDefense * config.critMultiplier;
  const critMaxAfterDefense = maxAfterDefense * config.critMultiplier;
  
  const shieldAbsorption = Math.min(player.shield, maxAfterDefense * config.shieldAbsorptionRate);
  
  const minDamage = missChance > 0 ? 0 : Math.max(1, Math.floor(minAfterDefense - shieldAbsorption));
  const maxDamage = critChance > 0 ? Math.max(1, Math.floor(critMaxAfterDefense)) : Math.max(1, Math.floor(maxAfterDefense - shieldAbsorption));
  
  const expectedDamage = 
    (missChance * 0) +
    (normalHitChance * ((Math.max(1, minAfterDefense - shieldAbsorption) + Math.max(1, maxAfterDefense - shieldAbsorption)) / 2)) +
    (critChance * ((Math.max(1, critMinAfterDefense) + Math.max(1, critMaxAfterDefense)) / 2));
  
  return {
    min: Math.floor(minDamage),
    max: Math.floor(maxDamage),
    expected: Math.floor(expectedDamage),
    critChance,
    missChance,
  };
}

export function simulateBattle(
  dice: Die[],
  player: Ship,
  enemy: Enemy,
  config: GameConfig
): SimulationMetrics {
  const allocations = getAllocations(dice);
  
  let playerDamageToEnemy: DamageRange = { min: 0, max: 0, expected: 0, critChance: 0, missChance: 0 };
  let playerShieldGain: DamageRange = { min: 0, max: 0, expected: 0, critChance: 0, missChance: 0 };
  let playerHealGain: DamageRange = { min: 0, max: 0, expected: 0, critChance: 0, missChance: 0 };
  let playerEvasionBonus = 0;
  let enemyEvasionReduction = 0;
  const overheatedCabins: CabinType[] = [];
  
  const totalDicePoints = getTotalPoints(dice);
  const energyCost = calculateEnergyCost(dice, config.energyCostPerPoint);
  const energyGap = Math.max(0, energyCost - player.energy);
  const efficiencyPenalty = energyGap > 0 ? 0.5 : 1;
  
  let wasDefending = enemy.intent.type === 'defend';
  let enemyDefenseBonus = wasDefending ? 0.2 : 0;
  
  for (const allocation of allocations) {
    const cabin = player.cabins.find(c => c.type === allocation.cabinType);
    if (!cabin || cabin.damaged) continue;
    
    const isOverheated = allocation.totalPoints > config.overheatThreshold;
    if (isOverheated) {
      overheatedCabins.push(allocation.cabinType);
      continue;
    }
    
    const effect = calculateCabinEffect(
      allocation.cabinType,
      allocation.totalPoints * efficiencyPenalty,
      player,
      enemy,
      config
    );
    
    switch (allocation.cabinType) {
      case 'weapon': {
        if (!isOverheated) {
          const weaponDice = dice.filter(d => d.assignedTo === 'weapon');
          const sixCount = getCriticalCount(weaponDice);
          const bonusCritRate = sixCount * config.critBonusRate;
          const guaranteedCrit = sixCount >= 2;
          const totalCritRate = Math.min(0.9, player.critRate + bonusCritRate);
          
          const effectiveEnemyEvasion = Math.max(0, enemy.evasion - enemyEvasionReduction);
          const effectiveEnemyDefense = Math.min(0.8, enemy.defense + enemyDefenseBonus);
          
          playerDamageToEnemy = calculateDamageRange(
            effect.value,
            totalCritRate,
            effectiveEnemyEvasion,
            effectiveEnemyDefense,
            enemy.shield,
            config,
            guaranteedCrit
          );
        }
        break;
      }
      case 'shield': {
        if (!isOverheated) {
          playerShieldGain = calculateShieldRange(
            effect.value,
            player.maxShield,
            player.shield
          );
        }
        break;
      }
      case 'repair': {
        if (!isOverheated) {
          playerHealGain = calculateHealRange(
            effect.value,
            player.maxHp,
            player.hp
          );
        }
        break;
      }
      case 'engine': {
        if (!isOverheated) {
          playerEvasionBonus += effect.value;
        }
        break;
      }
      case 'scanner': {
        if (!isOverheated) {
          enemyEvasionReduction += effect.value;
        }
        break;
      }
    }
  }
  
  const enemyDamageToPlayer = calculateEnemyDamageRange(
    enemy,
    player,
    playerEvasionBonus,
    config
  );
  
  const shieldAfterGain = player.shield + playerShieldGain.expected;
  const effectiveShieldAbsorption = Math.min(shieldAfterGain, enemyDamageToPlayer.expected * config.shieldAbsorptionRate);
  const netEnemyDamage = Math.max(0, enemyDamageToPlayer.expected - effectiveShieldAbsorption);
  
  const hpAfterHeal = Math.min(player.maxHp, player.hp + playerHealGain.expected);
  const expectedPlayerHpAfter = hpAfterHeal - netEnemyDamage;
  const expectedEnemyHpAfter = enemy.hp - playerDamageToEnemy.expected;
  
  const minPlayerHp = player.hp - enemyDamageToPlayer.max;
  const maxPlayerHp = Math.min(player.maxHp, player.hp + playerHealGain.max);
  const minEnemyHp = Math.max(0, enemy.hp - playerDamageToEnemy.max);
  const maxEnemyHp = enemy.hp - playerDamageToEnemy.min;
  
  const expectedPlayerHp: DamageRange = {
    min: Math.max(0, minPlayerHp),
    max: maxPlayerHp,
    expected: Math.max(0, expectedPlayerHpAfter),
    critChance: 0,
    missChance: 0,
  };
  
  const expectedEnemyHp: DamageRange = {
    min: minEnemyHp,
    max: maxEnemyHp,
    expected: Math.max(0, expectedEnemyHpAfter),
    critChance: 0,
    missChance: 0,
  };
  
  let survivalRisk: 'low' | 'medium' | 'high' | 'critical';
  const hpRatio = expectedPlayerHp.expected / player.maxHp;
  const maxDamage = enemyDamageToPlayer.max;
  const hpAfterMaxDamage = player.hp + playerHealGain.max - maxDamage;
  
  if (hpAfterMaxDamage <= 0) {
    survivalRisk = 'critical';
  } else if (hpRatio < 0.2) {
    survivalRisk = 'high';
  } else if (hpRatio < 0.5) {
    survivalRisk = 'medium';
  } else {
    survivalRisk = 'low';
  }
  
  if (overheatedCabins.length > 0) {
    survivalRisk = survivalRisk === 'low' ? 'medium' : survivalRisk;
  }
  
  if (energyGap > 0) {
    survivalRisk = survivalRisk === 'low' ? 'medium' : survivalRisk;
  }
  
  return {
    playerDamageToEnemy,
    enemyDamageToPlayer,
    playerShieldGain,
    playerHealGain,
    playerEvasionBonus,
    enemyEvasionReduction,
    energyCost,
    energyGap,
    overheatedCabins,
    survivalRisk,
    expectedPlayerHp,
    expectedEnemyHp,
  };
}

export function generatePlanName(allocations: AllocationResult[]): string {
  const cabinNames: Record<CabinType, string> = {
    weapon: '攻击',
    shield: '护盾',
    repair: '维修',
    engine: '机动',
    scanner: '扫描',
  };
  
  if (allocations.length === 0) {
    return '未分配';
  }
  
  const primary = allocations.reduce((a, b) => a.totalPoints > b.totalPoints ? a : b);
  const secondary = allocations.filter(a => a !== primary).sort((a, b) => b.totalPoints - a.totalPoints)[0];
  
  let name = cabinNames[primary.cabinType] + '流';
  if (secondary && secondary.totalPoints >= primary.totalPoints * 0.5) {
    name = cabinNames[primary.cabinType] + '+' + cabinNames[secondary.cabinType];
  }
  
  return name;
}
