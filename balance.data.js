// AUTO-GENERATED from data/balance.json by tools/gen_balance.py.
// Do NOT edit by hand — edit data/balance.json and re-run the generator.
window.BALANCE = {
  "_note": "Single source of truth for DIFFICULTY, ECONOMY, and MAP GEOMETRY. tools/balance_sim.py reads this file directly; the game reads it via the generated balance.data.js (run tools/gen_balance.py after editing). Only pure art (colors/shapes/blurbs) stays in main.js. Rule: if the balance sim needs a number to compute win-rate, it belongs in this file \u2014 including per-tower upgrade deltas ('up'), the map (path + slots), and the wave generator (waveGen).",
  "target_win_rate": [
    0.45,
    0.6
  ],
  "economy": {
    "startCurrency": 150,
    "startLives": 20,
    "earnPerWave": 40,
    "upgradeCost": [
      0,
      70,
      100
    ],
    "earlyCallBonus": 18,
    "earlyCallWindow": 8
  },
  "map": {
    "path": [
      {
        "x": -30,
        "y": 70
      },
      {
        "x": 60,
        "y": 70
      },
      {
        "x": 60,
        "y": 350
      },
      {
        "x": 200,
        "y": 350
      },
      {
        "x": 200,
        "y": 70
      },
      {
        "x": 340,
        "y": 70
      },
      {
        "x": 340,
        "y": 350
      },
      {
        "x": 480,
        "y": 350
      },
      {
        "x": 480,
        "y": 70
      },
      {
        "x": 620,
        "y": 70
      },
      {
        "x": 620,
        "y": 350
      },
      {
        "x": 740,
        "y": 350
      },
      {
        "x": 740,
        "y": 210
      }
    ],
    "slots": [
      {
        "x": 130,
        "y": 150
      },
      {
        "x": 130,
        "y": 290
      },
      {
        "x": 270,
        "y": 150
      },
      {
        "x": 270,
        "y": 290
      },
      {
        "x": 410,
        "y": 150
      },
      {
        "x": 410,
        "y": 290
      },
      {
        "x": 550,
        "y": 150
      },
      {
        "x": 550,
        "y": 290
      },
      {
        "x": 680,
        "y": 150
      },
      {
        "x": 680,
        "y": 290
      }
    ],
    "coreRadius": 24
  },
  "enemyTypes": {
    "mote": {
      "hpMul": 1.0,
      "speedMul": 1.0,
      "reward": 5
    },
    "runner": {
      "hpMul": 0.6,
      "speedMul": 1.7,
      "reward": 5
    },
    "brute": {
      "hpMul": 2.6,
      "speedMul": 0.7,
      "reward": 9
    },
    "swarm": {
      "hpMul": 0.28,
      "speedMul": 1.2,
      "reward": 2
    }
  },
  "towers": {
    "arrow": {
      "cost": 50,
      "range": 130,
      "damage": 30,
      "cooldown": 0.75,
      "behavior": "single",
      "up": {
        "damage": 16,
        "range": 14,
        "cooldownMul": 0.86
      }
    },
    "cannon": {
      "cost": 85,
      "range": 118,
      "damage": 24,
      "cooldown": 1.3,
      "behavior": "splash",
      "splash": 46,
      "up": {
        "damage": 15,
        "splash": 10,
        "cooldownMul": 0.9
      }
    },
    "frost": {
      "cost": 70,
      "range": 120,
      "damage": 10,
      "cooldown": 0.8,
      "behavior": "slow",
      "slowFactor": 0.5,
      "slowDur": 1.2,
      "up": {
        "damage": 6,
        "slowFactorAdd": -0.08,
        "range": 12
      }
    },
    "sniper": {
      "cost": 95,
      "range": 235,
      "damage": 70,
      "cooldown": 1.85,
      "behavior": "single",
      "up": {
        "damage": 45,
        "range": 26,
        "cooldownMul": 0.88
      }
    },
    "zap": {
      "cost": 35,
      "range": 96,
      "damage": 12,
      "cooldown": 0.32,
      "behavior": "single",
      "up": {
        "damage": 7,
        "range": 8,
        "cooldownMul": 0.85
      }
    }
  },
  "waveGen": {
    "waveCount": 20,
    "hpBase": 70,
    "hpGrowth": 1.134,
    "speedBase": 50,
    "speedStep": 1.4,
    "speedMax": 82,
    "intervalBase": 1.0,
    "intervalStep": 0.02,
    "intervalMin": 0.5,
    "baseCount": 6,
    "countStep": 0.6,
    "typeUnlock": {
      "mote": 0,
      "runner": 1,
      "swarm": 2,
      "brute": 4
    },
    "endless": false
  }
};
