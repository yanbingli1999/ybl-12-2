import React from 'react';
import { Shield, Heart, Swords, Zap, AlertTriangle, CheckCircle, XCircle, Trash2, RotateCcw, Check } from 'lucide-react';
import type { SimulationPlan, DamageRange, CabinType } from '../../types';
import { useSimulationStore } from '../../store/useSimulationStore';

interface SimulationCardProps {
  plan: SimulationPlan;
  isSelected: boolean;
  index: number;
  isApplied: boolean;
}

const cabinNames: Record<CabinType, string> = {
  weapon: '武器',
  shield: '护盾',
  repair: '维修',
  engine: '引擎',
  scanner: '扫描',
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'low': return 'text-neon-green';
    case 'medium': return 'text-neon-yellow';
    case 'high': return 'text-orange-500';
    case 'critical': return 'text-neon-red';
    default: return 'text-gray-400';
  }
};

const getRiskBgColor = (risk: string) => {
  switch (risk) {
    case 'low': return 'bg-neon-green/10 border-neon-green/30';
    case 'medium': return 'bg-neon-yellow/10 border-neon-yellow/30';
    case 'high': return 'bg-orange-500/10 border-orange-500/30';
    case 'critical': return 'bg-neon-red/10 border-neon-red/30';
    default: return 'bg-space-700 border-space-600';
  }
};

const getRiskIcon = (risk: string) => {
  switch (risk) {
    case 'low': return <CheckCircle className="w-4 h-4" />;
    case 'medium': return <AlertTriangle className="w-4 h-4" />;
    case 'high': return <AlertTriangle className="w-4 h-4" />;
    case 'critical': return <XCircle className="w-4 h-4" />;
    default: return null;
  }
};

const getRiskLabel = (risk: string) => {
  switch (risk) {
    case 'low': return '低风险';
    case 'medium': return '中风险';
    case 'high': return '高风险';
    case 'critical': return '致命';
    default: return '未知';
  }
};

const DamageRangeDisplay: React.FC<{ range: DamageRange; label: string; icon: React.ReactNode; color: string }> = ({ 
  range, label, icon, color 
}) => {
  if (range.min === 0 && range.max === 0 && range.expected === 0) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`${color}`}>{icon}</span>
      <span className="text-gray-400">{label}:</span>
      <span className="text-white font-mono">
        {range.min}-{range.max}
        {range.critChance > 0 && (
          <span className="text-neon-yellow text-xs ml-1">
            ({(range.critChance * 100).toFixed(0)}%暴击)
          </span>
        )}
        {range.missChance > 0 && (
          <span className="text-gray-500 text-xs ml-1">
            ({(range.missChance * 100).toFixed(0)}%闪避)
          </span>
        )}
      </span>
      <span className="text-gray-500 text-xs">
        期望: {range.expected}
      </span>
    </div>
  );
};

export const SimulationCard: React.FC<SimulationCardProps> = ({ plan, isSelected, index, isApplied }) => {
  const { selectSimulationPlan, deleteSimulationPlan, applySimulationPlan } = useSimulationStore();
  const { metrics } = plan;
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  const getDiceAllocationSummary = () => {
    const allocations: Record<string, number[]> = {};
    plan.diceAllocation.forEach(die => {
      if (die.assignedTo) {
        if (!allocations[die.assignedTo]) {
          allocations[die.assignedTo] = [];
        }
        allocations[die.assignedTo].push(die.value);
      }
    });
    
    return Object.entries(allocations).map(([cabin, values]) => (
      <div key={cabin} className="flex items-center gap-1">
        <span className="text-xs text-gray-400">{cabinNames[cabin as CabinType]}:</span>
        <span className="text-xs text-white font-mono">
          {values.map(v => (
            <span key={v} className={
              'inline-block w-4 h-4 text-center rounded mr-0.5 ' +
              (v === 6 ? 'bg-neon-yellow text-space-900' : 'bg-space-600 text-white')
            }>
              {v}
            </span>
          ))}
        </span>
      </div>
    ));
  };
  
  return (
    <div 
      className={
        'glass-panel rounded-lg p-4 cursor-pointer transition-all duration-300 relative ' +
        (isApplied 
          ? 'ring-2 ring-neon-green shadow-lg shadow-neon-green/20 bg-neon-green/5' 
          : isSelected 
            ? 'ring-2 ring-neon-blue shadow-lg shadow-neon-blue/20' 
            : 'hover:bg-space-700/50')
      }
      onClick={() => selectSimulationPlan(isSelected ? null : plan.id)}
    >
      {isApplied && (
        <div className="absolute -top-2 -right-2 bg-neon-green text-space-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
          <Check className="w-3 h-3" />
          已应用
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={
            'w-8 h-8 rounded-full flex items-center justify-center ' +
            (isSelected ? 'bg-neon-blue text-space-900' : 'bg-space-700 text-gray-400')
          }>
            {index + 1}
          </div>
          <div>
            <h4 className="font-display font-bold text-white">{plan.name}</h4>
            <p className="text-xs text-gray-500">{formatTime(plan.timestamp)}</p>
          </div>
        </div>
        
        <div className={
          'flex items-center gap-1 px-2 py-1 rounded-full border text-xs ' +
          getRiskBgColor(metrics.survivalRisk)
        }>
          <span className={getRiskColor(metrics.survivalRisk)}>
            {getRiskIcon(metrics.survivalRisk)}
          </span>
          <span className={getRiskColor(metrics.survivalRisk)}>
            {getRiskLabel(metrics.survivalRisk)}
          </span>
        </div>
      </div>
      
      <div className="space-y-2 mb-3">
        <DamageRangeDisplay 
          range={metrics.playerDamageToEnemy}
          label="对敌伤害"
          icon={<Swords className="w-4 h-4" />}
          color="text-neon-red"
        />
        
        <DamageRangeDisplay 
          range={metrics.enemyDamageToPlayer}
          label="受到伤害"
          icon={<Shield className="w-4 h-4" />}
          color="text-neon-yellow"
        />
        
        {metrics.playerShieldGain.expected > 0 && (
          <DamageRangeDisplay 
            range={metrics.playerShieldGain}
            label="护盾恢复"
            icon={<Shield className="w-4 h-4" />}
            color="text-neon-blue"
          />
        )}
        
        {metrics.playerHealGain.expected > 0 && (
          <DamageRangeDisplay 
            range={metrics.playerHealGain}
            label="生命恢复"
            icon={<Heart className="w-4 h-4" />}
            color="text-neon-green"
          />
        )}
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span>能量消耗: {metrics.energyCost}</span>
          {metrics.energyGap > 0 && (
            <span className="text-neon-red ml-1">(缺口: {metrics.energyGap})</span>
          )}
        </div>
        
        {metrics.playerEvasionBonus > 0 && (
          <div className="text-neon-blue">
            闪避 +{(metrics.playerEvasionBonus * 100).toFixed(0)}%
          </div>
        )}
        
        {metrics.enemyEvasionReduction > 0 && (
          <div className="text-neon-purple">
            敌方闪避 -{(metrics.enemyEvasionReduction * 100).toFixed(0)}%
          </div>
        )}
      </div>
      
      {metrics.overheatedCabins.length > 0 && (
        <div className="mb-3 p-2 bg-neon-red/10 border border-neon-red/30 rounded text-xs text-neon-red">
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          过热警告: {metrics.overheatedCabins.map(c => cabinNames[c]).join(', ')}
        </div>
      )}
      
      {isSelected && (
        <div className="mt-3 pt-3 border-t border-space-600">
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-2">骰子分配:</div>
            <div className="flex flex-wrap gap-2">
              {getDiceAllocationSummary()}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2 bg-space-900/50 rounded">
              <div className="text-xs text-gray-400">期望我方HP</div>
              <div className="text-neon-green font-mono">
                {metrics.expectedPlayerHp.min}-{metrics.expectedPlayerHp.max}
                <span className="text-xs text-gray-500 ml-1">
                  (期望: {metrics.expectedPlayerHp.expected})
                </span>
              </div>
            </div>
            <div className="p-2 bg-space-900/50 rounded">
              <div className="text-xs text-gray-400">期望敌方HP</div>
              <div className="text-neon-red font-mono">
                {metrics.expectedEnemyHp.min}-{metrics.expectedEnemyHp.max}
                <span className="text-xs text-gray-500 ml-1">
                  (期望: {metrics.expectedEnemyHp.expected})
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                applySimulationPlan(plan.id);
              }}
              className={
                'flex-1 flex items-center justify-center gap-1 text-sm px-4 py-2 rounded-lg font-medium transition-all ' +
                (isApplied 
                  ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 cursor-default' 
                  : 'btn-success')
              }
              disabled={isApplied}
            >
              {isApplied ? (
                <>
                  <Check className="w-4 h-4" />
                  已应用到战场
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  恢复此方案
                </>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSimulationPlan(plan.id);
              }}
              className="px-3 py-2 bg-space-700 border border-space-600 rounded-lg text-gray-400 hover:bg-neon-red/20 hover:text-neon-red hover:border-neon-red/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
