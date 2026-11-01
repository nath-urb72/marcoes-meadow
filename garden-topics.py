# ===== TOPIC 1 =====
# Topic 1: Python OOP + Big O + Stacks

class GameAction:
    def __init__(self, label):
        self.label = label

class ActionHistoryStack:
    def __init__(self):
        self.action_stack = []   # the END of the list is the TOP of the stack

    def push_action(self, label):   # O(1) amortized
        self.action_stack.append(GameAction(label))
        pushAction(label)   # bridge: show the label in the Action History panel

    def peek(self):   # O(1): look at the most recent action without removing it
        if self.is_empty():
            return None
        return self.action_stack[-1]

    def is_empty(self):   # O(1)
        return len(self.action_stack) == 0

    def size(self):   # O(1)
        return len(self.action_stack)

if "stack" not in globals():
    stack = ActionHistoryStack()

print(f"Action History Stack ready! ({stack.size()} action(s) recorded)\n")
print("Every planting, watering, harvest and shovel use is logged here permanently.")

# ===== TOPIC 2 =====
# Topic 2: Queues & Deques (FIFO Elements)

import random
from collections import deque

# Each event is either a straight resource change ("resource"), or an ACTION
# that does something to the garden itself ("water_plants"). Not every event
# is bad - Drizzle is a genuine benefit.
EVENT_TABLE = {
    "Drought":      {"kind": "water_rationing", "multiplier": 2},
    "Snowstorm":    {"kind": "growth_freeze"},
    "Drizzle":      {"kind": "water_plants",     "count": 3},
    "Market Rally": {"kind": "market_bonus",     "pct": 20},
    "Cold Snap":    {"kind": "stamina_penalty",  "multiplier": 2},
    # These two MUTATE nodes of Topic 5's price tree: one color tier's sell prices move for a few days.
    "Festival Demand": {"kind": "price_shift", "factor": 1.3,  "days": 3},
    "Market Glut":     {"kind": "price_shift", "factor": 0.75, "days": 3},
}

# ---- Harvest mutations ----
# Every harvest rolls MUTATION_CHANCE once for EACH climate event active that day. A hit gives that
# event's themed mutation, and the plant sells for the multiplier. On a day with no event the only
# mutation is "Lucky". Harder events pay more. If several rolls hit, one of them is picked.
MUTATION_CHANCE = 0.20
MUTATIONS = {                       # event name -> (mutation, sell-price multiplier)
    "Drought":         ("Dried",   2.5),
    "Cold Snap":       ("Chilled", 2.5),
    "Snowstorm":       ("Frosted", 3.0),
    "Market Glut":     ("Bumper",  2.5),
    "Drizzle":         ("Dewy",    1.75),
    "Market Rally":    ("Gilded",  1.75),
    "Festival Demand": ("Festive", 2.0),
}
LUCKY_MUTATION = ("Lucky", 1.5)     # a normal day, no event active
MUTATION_MULTIPLIER = {name: mult for name, mult in list(MUTATIONS.values()) + [LUCKY_MUTATION]}

class ClimateEvent:
    def __init__(self, name, data):
        self.name = name
        self.data = data   # the EVENT_TABLE entry: {"kind": ..., ...}


class ClimateQueue():
    def __init__(self):
        self.queue = deque()

    def add_event(self, event_name):   # O(1): enqueue at the back
        self.queue.append(ClimateEvent(event_name, EVENT_TABLE[event_name]))
        print(f"Successfully added {event_name}!\n")
        self.refresh_display()

    def process_next_event(self):   # O(1): dequeue from the front
        if len(self.queue) == 0:
            print("Empty queue!\n")
            return None
        event = self.queue.popleft()
        print(f"Processed {event.name}\n")
        self.add_event(random.choice(list(EVENT_TABLE)))   # keep the forecast full
        return event

    def refresh_display(self):
        updateClimateQueue([event.name for event in self.queue])


if "q" not in globals():
    q = ClimateQueue()
    for event_name in EVENT_TABLE:
        q.add_event(event_name)

q.refresh_display()
print("Climate Queue (FIFO) ready! Events are drawn 0-2 per day when the day ends, not every day.")

# ===== TOPIC 3 =====
# Topic 3: Static/Dynamic Arrays, 2D Lists, & Memory Structures

import random

def _require(*names):
    missing = [name for name in names if name not in globals()]
    if missing:
        raise RuntimeError("Run the earlier topics first (1 = Stack, 2 = Queue). Missing: " + ", ".join(missing))

_require("stack", "q")

# =====================================================================
# MASTER PLANT DATA (a dict = a hash table: O(1) average lookup by name)
# =====================================================================

COLOR_CHAINS = {
    "RED":          {"chain": "RED",   "depth": 0, "opens_after": None},
    "ORANGE":       {"chain": "RED",   "depth": 1, "opens_after": "RED"},
    "YELLOW":       {"chain": "RED",   "depth": 1, "opens_after": "RED"},
    "GREEN":        {"chain": "GREEN", "depth": 0, "opens_after": None},
    "VIOLET":  {"chain": "GREEN", "depth": 1, "opens_after": "GREEN"},
    "PINK":         {"chain": "GREEN", "depth": 2, "opens_after": "VIOLET"},
    "BROWN":        {"chain": "BROWN", "depth": 0, "opens_after": None},
}

# One colored heart per tier, used by the Plant Book instead of a generic icon.
COLOR_HEART = {
    "RED": "❤️", "ORANGE": "🧡", "YELLOW": "💛", "GREEN": "💚",
    "VIOLET": "💜", "PINK": "💗", "BROWN": "🤎",
}

# Harvests of the PREVIOUS plant in the same tier needed to unlock the next one.
UNLOCK_THRESHOLDS = [None, 10, 40, 140, 500]

TIER_ORDER = {
    "RED":         ["Tomato", "Apple", "Strawberry", "Chili Pepper", "Cherry"],
    "ORANGE":      ["Carrot", "Tangerine"],
    "YELLOW":      ["Corn", "Banana", "Lemon", "Sunflower", "Mango"],
    "GREEN":       ["Lettuce", "Cucumber", "Bell Pepper", "Broccoli", "Avocado"],
    "VIOLET": ["Grapes", "Sweet Potato", "Eggplant", "Blueberry"],
    "PINK":        ["Chrysanthemum", "Tulip", "Peach", "Hibiscus", "Cherry Blossom"],
    "BROWN":       ["Potato", "Onion", "Garlic", "Coconut"],
}

_EMOJI = {
    "Tomato": "🍅", "Apple": "🍎", "Strawberry": "🍓", "Chili Pepper": "🌶️", "Cherry": "🍒",
    "Carrot": "🥕", "Tangerine": "🍊",
    "Corn": "🌽", "Banana": "🍌", "Lemon": "🍋", "Sunflower": "🌻", "Mango": "🥭",
    "Lettuce": "🥬", "Cucumber": "🥒", "Bell Pepper": "🫑", "Broccoli": "🥦", "Avocado": "🥑",
    "Grapes": "🍇", "Sweet Potato": "🍠", "Eggplant": "🍆", "Blueberry": "🫐",
    "Chrysanthemum": "💮", "Tulip": "🌷", "Peach": "🍑", "Hibiscus": "🌺", "Cherry Blossom": "🌸",
    "Potato": "🥔", "Onion": "🧅", "Garlic": "🧄", "Coconut": "🥥",
}


# ---- Seed prices: one steady curve across all 30 plants ----
# Plants are ranked shallowest tier first (then by position inside the tier, then by
# tier order). Every rank costs the same multiple of the rank before it, climbing from
# the cheapest starter to the rarest plant in the game.
BASE_PRICE = 20        # rank 1: Tomato
TOP_PRICE = 100_000    # last rank: Cherry Blossom
SELL_MULTIPLIER = 1.5  # sell price = seed price x this


def _nice_price(x):
    """Round to a tidy number: whole coins under 100, then steps of 5, 50 and 500."""
    if x < 100:
        return int(round(x))
    step = 5 if x < 1000 else 50 if x < 10000 else 500
    return int(round(x / step) * step)


def _price_ladder():
    ranked = sorted(
        (COLOR_CHAINS[color]["depth"], position, tier_index, name)
        for tier_index, (color, names) in enumerate(TIER_ORDER.items())
        for position, name in enumerate(names)
    )
    ratio = (TOP_PRICE / BASE_PRICE) ** (1 / (len(ranked) - 1))   # about x1.34 per rank
    return {name: _nice_price(BASE_PRICE * ratio ** rank)
            for rank, (_, _, _, name) in enumerate(ranked)}


def _build_plant_data():
    data = {}
    prices = _price_ladder()
    for color, names in TIER_ORDER.items():
        depth = COLOR_CHAINS[color]["depth"]
        chain = COLOR_CHAINS[color]["chain"]
        opens_after = COLOR_CHAINS[color]["opens_after"]
        for position, name in enumerate(names):
            # Days to mature. At least 3, so all four stages (seed, seedling, sprout,
            # mature) get shown; rarer and deeper plants take longer.
            grow_days = 3 + position + (depth * 2)
            cost = prices[name]
            data[name] = {
                "name": name, "emoji": _EMOJI[name], "color": color, "chain": chain,
                "depth": depth, "position": position,
                "cost": cost, "grow_days": grow_days,
                "sell_price": int(cost * SELL_MULTIPLIER + 0.5),   # rounds half up
                "unlocked_by_default": (position == 0 and depth == 0),
                "unlock_threshold": UNLOCK_THRESHOLDS[position] if position > 0 else None,
                "opens_after_tier": opens_after if position == 0 else None,
            }
    return data


if "PLANT_DATA" not in globals():
    PLANT_DATA = _build_plant_data()


class Plant:
    """A planted instance. Every plant starts as a SEED and grows toward MATURE
    as growth_progress rises. Only a MATURE plant can be harvested or sold."""
    STAGES = ("seed", "seedling", "sprout", "mature")

    def __init__(self, name, emoji, cost, grow_days=3, sell_price=0):
        self.name = name
        self.emoji = emoji
        self.cost = cost
        self.grow_days = max(3, grow_days)   # four visible stages need at least 3 days
        self.sell_price = sell_price
        self.growth_progress = 0
        self.watered_today = False
        self.infected = False        # Topic 7: set by the Crawling Blight, cleared by Cleansing Spray
        self.stage = "seed"
        self.update_stage()

    @classmethod
    def from_data(cls, name):   # O(1) average: PLANT_DATA is a hash table
        d = PLANT_DATA[name]
        return cls(d["name"], d["emoji"], d["cost"], d["grow_days"], d["sell_price"])

    def clone(self):
        """A fresh SEED of this species - used when planting a new tile."""
        return Plant(self.name, self.emoji, self.cost, self.grow_days, self.sell_price)

    def stage_thresholds(self):
        """Growth at which a plant becomes a seedling, and then a sprout. The days
        before 'mature' are split into thirds, so each of the first three stages
        lasts at least one day."""
        seedling_at = max(1, self.grow_days // 3)
        sprout_at = max(seedling_at + 1, (2 * self.grow_days) // 3)
        return seedling_at, sprout_at

    def update_stage(self):
        seedling_at, sprout_at = self.stage_thresholds()
        if self.growth_progress >= self.grow_days:
            self.stage = "mature"
        elif self.growth_progress >= sprout_at:
            self.stage = "sprout"
        elif self.growth_progress >= seedling_at:
            self.stage = "seedling"
        else:
            self.stage = "seed"

    def grow_one_day(self):
        if self.stage != "mature":
            self.growth_progress = min(self.grow_days, self.growth_progress + 1)
            self.update_stage()

    def start_new_day(self):
        """Clear the once-per-day watering flag. Kept apart from growth so a
        Snowstorm (no growth) still gives every plant a fresh day."""
        self.watered_today = False

    def water(self):
        """+1 growth_progress on top of the natural daily tick. Returns True if it helped."""
        if self.watered_today or self.stage == "mature":
            return False
        self.growth_progress = min(self.grow_days, self.growth_progress + 1)
        self.watered_today = True
        self.update_stage()
        return True


class Resources:
    # There is no shared "seeds" pool any more: seeds are owned per plant
    # (GardenGame.seed_counts) and bought from Merchant Marco.
    CAPS = {"water": 200, "coins": None}

    def __init__(self, water, coins):
        self.values = {"water": water,"coins": coins}

    def get(self, key):
        return self.values[key]

    def change(self, key, amount):
        value = self.values[key] + amount
        cap = self.CAPS[key]
        self.values[key] = max(0, value if cap is None else min(cap, value))

    def sync(self):
        updateResources(**self.values)


class GardenGrid:
    def __init__(self, rows=10, cols=10):
        self.rows = rows
        self.cols = cols
        self.cells = [[None] * cols for _ in range(rows)]

    def to_position(self, row, col):
        return row * self.cols + col

    def in_bounds(self, row, col):
        return 0 <= row < self.rows and 0 <= col < self.cols

    def is_empty(self, row, col):
        return self.cells[row][col] is None

    def place(self, row, col, plant):
        self.cells[row][col] = plant
        self.redraw(row, col)

    def remove(self, row, col):
        plant = self.cells[row][col]
        self.cells[row][col] = None
        self.redraw(row, col)
        return plant

    def redraw(self, row, col):
        """Sends a tile's current look to the page. Topic 7's night system can override it:
        a Ward, a patch of Blight, or an infected plant (see NightDefense.tile_look)."""
        pos = self.to_position(row, col)
        night = globals().get("night_defense")
        look = night.tile_look(row, col) if night is not None else None
        if look is not None:
            addPlantToGrid(pos, look[0], look[1])
            return
        plant = self.cells[row][col]
        if plant is not None:
            addPlantToGrid(pos, plant.name, plant.stage)
        else:
            addPlantToGrid(pos, "", "")

    def each_plant(self):
        for row in range(self.rows):
            for col in range(self.cols):
                plant = self.cells[row][col]
                if plant is not None:
                    yield row, col, plant


# A mutated plant is a separate stack: the Inventory and Market dicts are keyed by a STACK KEY,
# the plant name for a normal plant or "Tomato::Dried" for a mutated one. (A tuple key would work
# too; a string is what the page sends back when a slot is clicked.)
def stack_key(name, mutation=None):
    return f"{name}::{mutation}" if mutation else name

def split_key(key):
    name, _, mutation = key.partition("::")
    return name, (mutation or None)

def stack_label(key):
    """What the player reads: 'Tomato' or 'Dried Tomato'."""
    name, mutation = split_key(key)
    return f"{mutation} {name}" if mutation else name


class Inventory:
    """Harvested plants waiting to be sold. A dict = a hash table, stack key -> quantity."""
    def __init__(self):
        self.items = {}
        self.recent = []   # stack keys, least recently harvested first (a list: newest at the end)

    def add(self, name, qty=1, mutation=None):
        key = stack_key(name, mutation)
        self.items[key] = self.items.get(key, 0) + qty
        if key in self.recent:       # O(n), and n is at most 60
            self.recent.remove(key)
        self.recent.append(key)      # O(1): this stack was just harvested

    def take(self, name, qty):
        have = self.items.get(name, 0)
        taken = min(have, qty)
        if taken <= 0:
            return 0
        self.items[name] = have - taken
        if self.items[name] <= 0:
            del self.items[name]
            self.recent.remove(name)
        return taken

    def rows(self, price_fn=None):   # price_fn(key) -> coins; default is the base sell price
        price_fn = price_fn or (lambda key: PLANT_DATA[split_key(key)[0]]["sell_price"])
        return [(key, PLANT_DATA[split_key(key)[0]]["emoji"], qty, price_fn(key))
                for key, qty in sorted(self.items.items())]


class Market:
    """Plants staged for sale. Everything here sells when the day ends."""
    def __init__(self):
        self.items = {}

    def stage(self, name, qty):
        self.items[name] = self.items.get(name, 0) + qty

    def rows(self, price_fn=None):
        price_fn = price_fn or (lambda key: PLANT_DATA[split_key(key)[0]]["sell_price"])
        return [(key, PLANT_DATA[split_key(key)[0]]["emoji"], qty, price_fn(key))
                for key, qty in sorted(self.items.items())]

    def total(self, price_fn=None):
        price_fn = price_fn or (lambda key: PLANT_DATA[split_key(key)[0]]["sell_price"])
        return sum(price_fn(key) * qty for key, qty in self.items.items())

    def payout(self, price_fn=None):
        earned = self.total(price_fn)
        self.items = {}
        return earned


class Merchant:
    """Merchant Marco: sells seeds, water and a stamina tonic. Coins in, supplies out.
    A seed costs the plant's own price, and only unlocked plants can be bought."""
    WATER_PRICE = 2        # coins per point of Water
    TONIC_PRICE = 30       # coins
    TONIC_RESTORE = 30     # stamina
    WARD_PRICE = 100       # coins per Ward (Topic 7)
    SPRAY_PRICE = 150      # coins per Cleansing Spray (Topic 7)
    LENS_PRICE = 80        # coins per Scout's Lens (Topic 10)
    RADAR_PRICE = 400      # coins, one time: unlocks the Blight Radar tool (Topic 9)
    LOCKBOX_PRICE = 350    # coins, one time: the Magpie can never take your most valuable stack (Topic 11)

    def __init__(self, game):
        self.game = game

    def seed_rows(self):
        """Every plant in the game, cheapest first: (name, emoji, price, owned, unlocked)."""
        unlocked = {plant.name for plant in self.game.catalog}
        plants = sorted(PLANT_DATA.values(), key=lambda d: d["cost"])
        return [(d["name"], d["emoji"], d["cost"], self.game.seed_counts.get(d["name"], 0), d["name"] in unlocked)
                for d in plants]

    def buy_seed(self, name, qty=1):
        game = self.game
        qty = max(1, min(int(qty), 999))
        if name not in PLANT_DATA:
            return "Marco doesn't sell that."
        if game.find_plant(name) is None:
            return f"Marco can't sell {name} seeds until you unlock {name}."
        total = PLANT_DATA[name]["cost"] * qty
        coins = game.resources.get("coins")
        if coins < total:
            return f"Not enough coins: {qty} {name} seed(s) cost {total:,}c and you have {coins:,}c."
        game.resources.change("coins", -total)
        game.seed_counts[name] = game.seed_counts.get(name, 0) + qty
        stack.push_action(f"Bought {qty} {name} seed(s) for {total:,}c")
        game.resources.sync()
        game.refresh_dropdown()
        game.refresh_shop()
        return f"Bought {qty} {name} seed(s) for {total:,}c."

    def buy_water(self, amount):
        game = self.game
        room = Resources.CAPS["water"] - game.resources.get("water")
        if room <= 0:
            return "Your water reserves are already full."
        wanted = max(0, int(amount))
        if wanted <= 0:
            return "Choose how much water to buy."
        amount = min(wanted, room)          # never buy past the cap
        cost = amount * self.WATER_PRICE
        coins = game.resources.get("coins")
        if coins < cost:
            return f"Not enough coins: {amount}L of water costs {cost:,}c and you have {coins:,}c."
        game.resources.change("coins", -cost)
        game.resources.change("water", amount)
        stack.push_action(f"Bought {amount}L of water for {cost:,}c")
        game.resources.sync()
        game.refresh_shop()
        note = f" (only {room}L fit)" if wanted > room else ""
        rescue = game.rescue_if_stuck()
        return f"Bought {amount}L of water for {cost:,}c{note}." + (" " + rescue if rescue else "")

    def buy_water_full(self):
        return self.buy_water(Resources.CAPS["water"] - self.game.resources.get("water"))

    def buy_stamina_tonic(self):
        game = self.game
        coins = game.resources.get("coins")
        if coins < self.TONIC_PRICE:
            return f"Not enough coins: a Stamina Tonic costs {self.TONIC_PRICE:,}c and you have {coins:,}c."
        game.resources.change("coins", -self.TONIC_PRICE)
        game.stamina_tonics += 1
        stack.push_action(f"Bought a Stamina Tonic for {self.TONIC_PRICE:,}c")
        game.resources.sync()
        game.refresh_shop()
        rescue = game.rescue_if_stuck()
        return (f"Bought a Stamina Tonic for {self.TONIC_PRICE:,}c. You have {game.stamina_tonics}."
                + (" " + rescue if rescue else ""))

    def _buy_supply(self, qty, price, attr, singular):
        game = self.game
        qty = max(1, min(int(qty), 999))
        total = price * qty
        coins = game.resources.get("coins")
        if coins < total:
            return f"Not enough coins: {qty} {singular}(s) cost {total:,}c and you have {coins:,}c."
        game.resources.change("coins", -total)
        setattr(game, attr, getattr(game, attr) + qty)
        stack.push_action(f"Bought {qty} {singular}(s) for {total:,}c")
        game.resources.sync()
        game.refresh_shop()
        rescue = game.rescue_if_stuck()
        return (f"Bought {qty} {singular}(s) for {total:,}c. You have {getattr(game, attr)}."
                + (" " + rescue if rescue else ""))

    def buy_ward(self, qty=1):
        return self._buy_supply(qty, self.WARD_PRICE, "wards_owned", "Ward")

    def buy_spray(self, qty=1):
        return self._buy_supply(qty, self.SPRAY_PRICE, "sprays_owned", "Cleansing Spray")

    def buy_lockbox(self):
        game = self.game
        if game.lockbox_unlocked:
            return "You already own the Lockbox."
        coins = game.resources.get("coins")
        if coins < self.LOCKBOX_PRICE:
            return f"Not enough coins: the Lockbox costs {self.LOCKBOX_PRICE:,}c and you have {coins:,}c."
        game.resources.change("coins", -self.LOCKBOX_PRICE)
        game.lockbox_unlocked = True
        stack.push_action(f"Bought the Lockbox for {self.LOCKBOX_PRICE:,}c")
        game.resources.sync()
        game.refresh_shop()
        game.refresh_raid()
        return "Lockbox bought! Your most valuable stack is now safe from the Magpie."

    def buy_radar(self):
        game = self.game
        if game.radar_unlocked:
            return "You already own the Blight Radar."
        coins = game.resources.get("coins")
        if coins < self.RADAR_PRICE:
            return f"Not enough coins: the Blight Radar costs {self.RADAR_PRICE:,}c and you have {coins:,}c."
        game.resources.change("coins", -self.RADAR_PRICE)
        game.radar_unlocked = True
        stack.push_action(f"Bought the Blight Radar for {self.RADAR_PRICE:,}c")
        game.resources.sync()
        game.refresh_shop()
        return "Blight Radar unlocked! Pick the Radar tool and click any tile to scan it."

    def buy_lens(self, qty=1):
        return self._buy_supply(qty, self.LENS_PRICE, "lenses_owned", "Scout's Lens")

    def use_lens(self):
        """Spend a lens to see the predator and its planned route until the day ends."""
        game = self.game
        hound = globals().get("predator_system")
        magpie = globals().get("magpie_thief")
        hound_here = hound is not None and hound.present()
        raid_tonight = magpie is not None and magpie.raid_due(game.day)
        if game.lenses_owned <= 0:
            return "You don't have any Scout's Lenses. Merchant Marco sells them."
        if not hound_here and not raid_tonight:
            return "Nothing to see: no predator is hunting and no raid is due tonight."
        if game.lens_active:
            return "The lens is already showing tonight's threats."
        game.lenses_owned -= 1
        game.lens_active = True
        stack.push_action("Used a Scout's Lens")
        game.refresh_shop()
        if hound is not None:
            hound.publish()
        game.refresh_raid()
        seen = []
        if hound_here:
            seen.append(f"the {hound.NAME} and its route")
        if raid_tonight:
            seen.append("tonight's Magpie raid")
        return "The lens shows " + " and ".join(seen) + " until the day ends."

    def use_stamina_tonic(self):
        game = self.game
        if game.stamina_tonics <= 0:
            return "You don't have any Stamina Tonics. Marco sells them."
        if game.stamina >= game.MAX_STAMINA:
            return "You're already fully rested. Save the tonic for later."
        gained = min(self.TONIC_RESTORE, game.MAX_STAMINA - game.stamina)
        game.stamina_tonics -= 1
        game.stamina += gained
        stack.push_action(f"Used a Stamina Tonic (+{gained} stamina)")
        game.sync_stamina()
        game.refresh_shop()
        return f"Used a Stamina Tonic: +{gained} stamina."


class GardenGame:
    # 10x10 = 100 tiles. Stamina is set so a water-only day can cover about half
    # the garden (50 waterings at 10 stamina each = 500).
    MAX_STAMINA = 500
    STAMINA_COSTS = {"plant": 15, "water": 10, "harvest": 10, "shovel": 10, "ward": 15, "spray": 10, "defend": 20, "rescue": 25, "radar": 5}
    WATER_COST = 10   # Water resource spent per use of the watering can

    def __init__(self, catalog, resources, grid=None):
        self.catalog = catalog
        self.resources = resources
        self.grid = grid or GardenGrid()
        self.stamina = self.MAX_STAMINA
        self.day = 1
        self.harvest_counts = {}   # name -> lifetime harvest count, used to unlock the next plant
        self.inventory = Inventory()
        self.market = Market()
        # Seeds owned per plant (a dict = hash table, name -> count). Planting uses
        # one; buying from Merchant Marco is the only way to get more.
        self.seed_counts = {}
        self.stamina_tonics = 0    # bought from Marco, used later for +stamina
        self.wards_owned = 0       # Topic 7: bought from Marco, placed on empty tiles
        self.sprays_owned = 0      # Topic 7: bought from Marco, used on blighted tiles
        self.game_over = False     # Topic 7: set when the blight covers the whole garden
        self.lenses_owned = 0      # Topic 10: Scout's Lenses bought from Marco
        self.lens_active = False   # Topic 10: True once a lens is used, until the next End Day
        self.radar_unlocked = False  # Topic 9: bought once from Marco
        self.lockbox_unlocked = False  # Topic 11: bought once from Marco
        self.inv_sort = "recent"   # Inventory screen: "recent" | "low" | "high"
        self.inv_query = ""        # Inventory screen: what the player typed in Search
        self.merchant = Merchant(self)
        # Reset to defaults at the start of every end_day(); an event firing during
        # that day's event roll can change them for the day that's about to begin.
        self.todays_events = []            # names of the events rolled at the last End Day (for screen effects)
        self.stamina_cost_multiplier = 1   # Cold Snap
        self.water_cost_multiplier = 1     # Drought (Water Rationing)
        self._growth_frozen = False        # Snowstorm (Growth Freeze) - this day's tick only
        self._market_bonus_pct = 0         # Market Rally - this end_day's payout only

    # ---- catalog (dynamic array) ----
    def find_plant(self, name):   # O(n) scan of the currently-unlocked catalog
        for plant in self.catalog:
            if plant.name == name:
                return plant
        return None

    def add_to_catalog(self, plant):   # O(1) amortized
        self.catalog.append(plant)
        tree = globals().get("price_bst")
        if tree is not None:                     # Topic 5 has run: the new plant joins its price tree
            tree.insert(plant.cost, plant.name)
        self.refresh_dropdown()
        self.refresh_shop()

    def sorted_catalog(self):
        """Unlocked plants, cheapest first. Once Topic 5 has run this is an inorder
        walk of its price tree; before that it is a plain sort."""
        by_name = {plant.name: plant for plant in self.catalog}
        tree = globals().get("price_bst")
        if tree is not None:
            ordered = [by_name[node.name] for node in tree.inorder() if node.name in by_name]
            if len(ordered) == len(by_name):     # the tree knows every unlocked plant
                return ordered
        return sorted(self.catalog, key=lambda plant: plant.cost)

    # ---- selling prices: each node of Topic 5's price tree carries a modifier ----
    def price_modifier(self, key):
        name = split_key(key)[0]
        tree = globals().get("price_bst")
        node = tree.find(name) if tree is not None else None
        return node.modifier if node else 1.0

    def sell_price_for(self, key):
        """Today's price for a harvested stack: the plant's base sell price, times the modifier
        stored on its node in the price tree (1.0 when no event is moving it), times its
        mutation multiplier (1 for a normal plant)."""
        name, mutation = split_key(key)
        mutation_factor = MUTATION_MULTIPLIER.get(mutation, 1.0)
        return int(PLANT_DATA[name]["sell_price"] * self.price_modifier(name) * mutation_factor + 0.5)

    def roll_mutation(self):
        """Roll MUTATION_CHANCE once per active event (or once for 'Lucky' on a normal day).
        Returns the mutation's name, or None."""
        events = [e for e in self.active_effects() if e in MUTATIONS]
        candidates = [MUTATIONS[e][0] for e in events] or [LUCKY_MUTATION[0]]
        hits = [m for m in candidates if random.random() < MUTATION_CHANCE]
        return random.choice(hits) if hits else None

    def expire_price_shifts(self):
        tree = globals().get("price_bst")
        return tree.tick(self.day) if tree is not None else []

    # ---- stamina ----
    def spend_stamina(self, action):
        cost = self.STAMINA_COSTS[action] * self.stamina_cost_multiplier
        if self.stamina < cost:
            return "😴 Too tired for that today. Sell your harvest, then press End Day when ready."
        self.stamina -= cost
        self.sync_stamina()
        return None

    def _tired_notice(self):
        """Stamina hitting 0 no longer force-ends the day - it just tells the
        player, who can keep selling to the market and chooses when to rest."""
        if self.stamina <= 0:
            return "😴 You're exhausted for today! Sell what you've harvested, then press End Day when you're ready."
        return None

    # ---- dead-end rescue: Merchant Marco's free seed ----
    def is_stuck(self):
        """True when nothing can ever grow again: no seeds, nothing planted, nothing
        in the inventory or market, and not enough coins for the cheapest seed."""
        if any(count > 0 for count in self.seed_counts.values()):
            return False
        if any(not plant.infected for _, _, plant in self.grid.each_plant()):
            return False      # an infected plant can't grow, so it doesn't count as a way forward
        if self.inventory.items or self.market.items:
            return False
        cheapest = min(plant.cost for plant in self.catalog)
        return self.resources.get("coins") < cheapest

    def rescue_if_stuck(self):
        """Returns a message when Marco steps in, else an empty string."""
        if not self.is_stuck():
            return ""
        starter = min((p for p in self.catalog if PLANT_DATA[p.name]["unlocked_by_default"]),
                      key=lambda p: p.cost)
        self.seed_counts[starter.name] = self.seed_counts.get(starter.name, 0) + 1
        stack.push_action(f"Marco gave you a free {starter.name} seed")
        self.refresh_dropdown()
        self.refresh_shop()
        return f"Merchant Marco takes pity and gives you a free {starter.name} seed."

    # ---- Topic 7 hooks: the night system owns the rules, these just ask it ----
    def _night(self):
        return globals().get("night_defense")

    def _night_lock(self, row, col):
        """A message if blight (or a Ward) stops an ordinary tile action there, else ''."""
        night = self._night()
        return night.lock_message(row, col) if night is not None else ""

    def refresh_predator(self):
        hound = globals().get("predator_system")
        if hound is not None:
            hound.publish()

    def radar_at(self, row, col):
        radar = globals().get("blight_radar")
        return radar.scan(row, col) if radar is not None else "The Blight Radar isn't available yet."

    def refresh_raid(self):
        magpie = globals().get("magpie_thief")
        if magpie is not None:
            magpie.publish()

    def refresh_triage(self):
        board = globals().get("triage_board")
        if board is not None:
            board.publish()

    def rescue(self):
        board = globals().get("triage_board")
        return board.rescue() if board is not None else "Rescue isn't available yet."

    def quick_defend(self):
        hound = globals().get("predator_system")
        return hound.quick_defend() if hound is not None else "Quick-Defend isn't available yet."

    def ward_at(self, row, col):
        night = self._night()
        return night.place_ward(row, col) if night is not None else "Wards aren't available yet."

    def spray_at(self, row, col):
        night = self._night()
        return night.spray(row, col) if night is not None else "Cleansing Spray isn't available yet."

    # ---- the four tile actions ----
    def plant_at(self, row, col, plant_name):
        prototype = self.find_plant(plant_name)
        if prototype is None:
            if not any(self.seed_counts.values()):
                return "Your Seed Bag is empty. Buy seeds from Merchant Marco."
            return "Pick a seed from the Seed Bag first."
        if not self.grid.in_bounds(row, col):
            return "That tile is outside the garden."
        locked = self._night_lock(row, col)
        if locked:
            return locked
        if not self.grid.is_empty(row, col):
            return f"({row}, {col}) is already planted. Try watering, harvesting, or the shovel."
        if self.seed_counts.get(plant_name, 0) <= 0:
            return f"You don't have any {plant_name} seeds. Buy more from Merchant Marco."
        stamina_msg = self.spend_stamina("plant")
        if stamina_msg:
            return stamina_msg

        self.seed_counts[plant_name] -= 1          # a seed is used up; no coins change hands
        self.grid.place(row, col, prototype.clone())
        stack.push_action(f"Planted {prototype.name} at ({row}, {col})")
        self.refresh_dropdown()                    # the Seed Bag shows how many are left
        self.refresh_predator()

        return self._tired_notice() or f"Planted {prototype.name}."

    def water_at(self, row, col):
        if not self.grid.in_bounds(row, col):
            return "That tile is outside the garden."
        locked = self._night_lock(row, col)
        if locked:
            return locked
        plant = self.grid.cells[row][col]
        if plant is None:
            return "Nothing planted there yet."
        if plant.stage == "mature":
            return f"{plant.name} is already fully grown."
        if plant.watered_today:
            return f"{plant.name} has already been watered today."
        water_cost = self.WATER_COST * self.water_cost_multiplier
        if self.resources.get("water") < water_cost:
            return "Not enough water in reserve."
        stamina_msg = self.spend_stamina("water")
        if stamina_msg:
            return stamina_msg

        self.resources.change("water", -water_cost)
        plant.water()
        self.grid.redraw(row, col)
        stack.push_action(f"Watered {plant.name} at ({row}, {col})")
        self.resources.sync()
        self.refresh_shop()
        return self._tired_notice() or f"Watered {plant.name} - now {plant.stage}."

    def harvest_at(self, row, col):
        if not self.grid.in_bounds(row, col):
            return "That tile is outside the garden."
        locked = self._night_lock(row, col)
        if locked:
            return locked
        plant = self.grid.cells[row][col]
        if plant is None:
            return "Nothing to harvest there."
        if plant.stage != "mature":
            return f"{plant.name} isn't ready yet ({plant.stage})."
        stamina_msg = self.spend_stamina("harvest")
        if stamina_msg:
            return stamina_msg

        self.grid.remove(row, col)
        mutation = self.roll_mutation()
        self.inventory.add(plant.name, 1, mutation)
        self.harvest_counts[plant.name] = self.harvest_counts.get(plant.name, 0) + 1   # a mutant counts as one harvest
        label = stack_label(stack_key(plant.name, mutation))
        stack.push_action(f"Harvested {label} at ({row}, {col})")
        self.refresh_inventory()
        self.refresh_predator()

        newly_unlocked = self.check_unlocks()
        message = f"Harvested {plant.name}!"
        if mutation:
            message = (f"Harvested a {label}! It mutated: sells for "
                       f"x{MUTATION_MULTIPLIER[mutation]:g}.")
        if newly_unlocked:
            names = ", ".join(f"{PLANT_DATA[n]['emoji']} {n}" for n in newly_unlocked)
            message += f" Unlocked: {names}!"
            for n in newly_unlocked:
                stack.push_action(f"Unlocked {n}!")   # K2: unlocks are logged too

        tired = self._tired_notice()
        if tired and newly_unlocked:
            return f"{message} {tired}"               # K2: show both
        return tired or message

    def shovel_at(self, row, col):
        if not self.grid.in_bounds(row, col):
            return "That tile is outside the garden."
        night = self._night()
        if night is not None and night.has_ward(row, col):
            return night.remove_ward(row, col)
        locked = self._night_lock(row, col)
        if locked:
            return locked
        plant = self.grid.cells[row][col]
        if plant is None:
            return "Nothing planted there to remove."
        stamina_msg = self.spend_stamina("shovel")
        if stamina_msg:
            return stamina_msg

        self.grid.remove(row, col)
        stack.push_action(f"Removed {plant.name} at ({row}, {col}) with the shovel")
        self.refresh_predator()
        rescue = self.rescue_if_stuck()
        message = self._tired_notice() or f"Removed the {plant.name}. No refund."
        return f"{message} {rescue}" if rescue else message

    # ---- daily events: 0-2 drawn from the Climate Queue when the day ends,
    # not tied to planting, and not guaranteed every day ----
    def process_daily_events(self):
        messages = []
        self.todays_events = []
        for _ in range(random.randint(0, 1)):
            event = q.process_next_event()
            if event is not None:
                self.todays_events.append(event.name)
                messages.append(self.apply_event(event))
        return messages

    def active_effects(self):
        """Which climate events the page should dress the screen for. One-off events are the
        ones rolled at the last End Day. Price shifts are read from the Topic 5 price tree
        (a raised node = Festival Demand, a lowered one = Market Glut), so they stay on
        screen for as long as the prices really are moved, and go away when they expire."""
        names = [n for n in self.todays_events if EVENT_TABLE[n]["kind"] != "price_shift"]
        tree = globals().get("price_bst")
        if tree is not None:
            modifiers = [node.modifier for node in tree.shifted()]
            if any(m > 1 for m in modifiers):
                names.append("Festival Demand")
            if any(m < 1 for m in modifiers):
                names.append("Market Glut")
        else:
            names += [n for n in self.todays_events if EVENT_TABLE[n]["kind"] == "price_shift"]
        return names

    def refresh_effects(self):
        bridge = globals().get("updateScreenEffects")
        if bridge is not None:
            bridge(self.active_effects())

    def apply_event(self, event):
        data = event.data
        kind = data["kind"]

        if kind == "resource":
            for resource, change in data["effects"].items():
                self.resources.change(resource, change)
            summary = ", ".join(f"{change:+d} {resource}" for resource, change in data["effects"].items())
            return f"{event.name}! ({summary})"

        if kind == "water_plants":
            candidates = [(r, c, p) for r, c, p in self.grid.each_plant() if p.stage != "mature"]
            random.shuffle(candidates)
            watered = 0
            for row, col, plant in candidates[:data["count"]]:
                plant.growth_progress = min(plant.grow_days, plant.growth_progress + 1)
                plant.update_stage()
                self.grid.redraw(row, col)
                watered += 1
            return f"{event.name}! Automatically watered {watered} plant(s)."

        if kind == "water_rationing":
            self.water_cost_multiplier = data.get("multiplier", 2)
            return f"{event.name}! Watering costs {self.water_cost_multiplier}x today."

        if kind == "growth_freeze":
            self._growth_frozen = True
            return f"{event.name}! The cold halts all natural growth today."

        if kind == "market_bonus":
            self._market_bonus_pct = data.get("pct", 20)
            return f"{event.name}! Today's market payout gets a +{self._market_bonus_pct}% bonus."

        if kind == "stamina_penalty":
            self.stamina_cost_multiplier = data.get("multiplier", 2)
            return f"{event.name}! Every action costs {self.stamina_cost_multiplier}x stamina today."

        if kind == "price_shift":
            tree = globals().get("price_bst")
            if tree is None:
                return f"{event.name}! (The price board isn't running yet - run Topic 5.)"
            colors = sorted({PLANT_DATA[plant.name]["color"] for plant in self.catalog})
            color = random.choice(colors)
            until = self.day + data["days"]
            for plant in self.catalog:
                if PLANT_DATA[plant.name]["color"] == color:
                    tree.mutate(plant.name, data["factor"], until)     # node mutation, in place
            self.refresh_inventory()
            self.refresh_market()
            pct = round((data["factor"] - 1) * 100)
            return f"{event.name}! {color.title()} plants sell for {pct:+d}% for {data['days']} days."

        return f"{event.name} happened."

    # ---- unlocking: harvest counts drive the color-tier chain from Topic 4 ----
    def check_unlocks(self):
        newly_unlocked = []
        changed = True
        while changed:
            changed = False
            unlocked_names = {plant.name for plant in self.catalog}

            # within a tier: position p unlocks once the previous plant hits its threshold
            for names in TIER_ORDER.values():
                for position in range(1, len(names)):
                    name = names[position]
                    if name in unlocked_names:
                        continue
                    previous = names[position - 1]
                    if self.harvest_counts.get(previous, 0) >= UNLOCK_THRESHOLDS[position]:
                        self.add_to_catalog(Plant.from_data(name))
                        newly_unlocked.append(name)
                        unlocked_names.add(name)
                        changed = True

            # between tiers: a tier's first plant opens once its whole prerequisite tier is unlocked
            for color, meta in COLOR_CHAINS.items():
                if meta["opens_after"] is None:
                    continue
                prereq_names = TIER_ORDER[meta["opens_after"]]
                if all(name in unlocked_names for name in prereq_names):
                    first = TIER_ORDER[color][0]
                    if first not in unlocked_names:
                        self.add_to_catalog(Plant.from_data(first))
                        newly_unlocked.append(first)
                        unlocked_names.add(first)
                        changed = True
        if newly_unlocked and "plant_book" in globals():
            plant_book.render()   # guarded: Topic 4 may not have run yet
        return newly_unlocked

    # ---- market ----
    def sell_to_market(self, name):
        qty = self.inventory.items.get(name, 0)
        if qty <= 0:
            return "You don't have any of that to sell."
        self.inventory.take(name, qty)
        self.market.stage(name, qty)
        self.refresh_inventory()
        self.refresh_market()
        return f"Moved {qty}x {stack_label(name)} to the market."

    # ---- ending the day ----
    def end_day(self):
        if self.game_over:
            return "The blight took your garden. Press Restart to play again."
        self.lens_active = False           # a lens only lasts the day it was used
        radar = globals().get("blight_radar")
        if radar is not None:
            radar.clear()                  # a radar reading is only true until the night changes things
        # Reset every modifier BEFORE rolling events, so today's event roll decides
        # what the NEW day looks like (and Growth Freeze can still block the growth
        # tick a few lines down, since it fires before that tick runs).
        self.stamina_cost_multiplier = 1
        self.water_cost_multiplier = 1
        self._growth_frozen = False
        self._market_bonus_pct = 0

        event_messages = self.process_daily_events()
        for msg in event_messages:
            stack.push_action(msg)

        for row, col, plant in list(self.grid.each_plant()):
            if not self._growth_frozen and not plant.infected:    # blight stops growth
                plant.grow_one_day()
            plant.start_new_day()          # K1: always reset, frozen day or not
            self.grid.redraw(row, col)

        night = self._night()
        if night is not None:              # Topic 7: the night that ends today (before the day counter moves)
            report = night.run_night(self.day)
            if report:
                event_messages.append(report)
                stack.push_action(report)
        hound = globals().get("predator_system")
        if hound is not None:              # Topic 10: the predator moves after the blight has spread
            report = hound.run_night(self.day)
            if report:
                event_messages.append(report)
                stack.push_action(report)
        magpie = globals().get("magpie_thief")
        if magpie is not None:             # Topic 11: the Magpie raids whatever is still in the Inventory
            report = magpie.run_night(self.day)
            if report:
                event_messages.append(report)
                stack.push_action(report)

        earned = self.market.payout(self.sell_price_for)
        if earned and self._market_bonus_pct:
            bonus = round(earned * self._market_bonus_pct / 100)
            earned += bonus
            event_messages.append(f"Market Rally bonus: +{bonus:,} coins!")
            stack.push_action(event_messages[-1])      # K3: also goes in the Action History
        if earned:
            self.resources.change("coins", earned)

        self.day += 1
        self.stamina = self.MAX_STAMINA
        back_to_normal = self.expire_price_shifts()
        if back_to_normal:
            event_messages.append("Prices are back to normal for " + ", ".join(back_to_normal) + ".")
            stack.push_action(event_messages[-1])

        self.resources.sync()
        self.sync_stamina()
        self.sync_day()
        self.refresh_inventory()
        self.refresh_market()
        self.refresh_effects()
        self.refresh_predator()
        self.refresh_triage()

        stack.push_action(f"Day ended - Day {self.day} begins")
        message = f"Day {self.day} begins. Everyone is rested."
        if event_messages:
            message += " " + " ".join(event_messages)
        if earned:
            message += f" Market payout: +{earned:,} coins."
        if night is not None and night.garden_wiped():
            return message + " " + night.end_game()
        rescue = self.rescue_if_stuck()
        if rescue:
            message += " " + rescue
        return message

    # ---- display refreshers ----
    def refresh_dropdown(self):
        """The Seed Bag: only seeds you own, cheapest first, with how many you have."""
        addPlantsToDropdown([(plant.name, plant.emoji, self.seed_counts.get(plant.name, 0))
                             for plant in self.sorted_catalog() if self.seed_counts.get(plant.name, 0) > 0])

    def refresh_shop(self):
        updateShop(self.merchant.seed_rows(),
                   Merchant.WATER_PRICE, self.resources.get("water"), Resources.CAPS["water"],
                   Merchant.TONIC_PRICE, Merchant.TONIC_RESTORE, self.stamina_tonics)
        night_shop = globals().get("updateNightShop")
        if night_shop is not None:
            night_shop(Merchant.WARD_PRICE, self.wards_owned, Merchant.SPRAY_PRICE, self.sprays_owned,
                       Merchant.LENS_PRICE, self.lenses_owned, Merchant.RADAR_PRICE, self.radar_unlocked,
                       Merchant.LOCKBOX_PRICE, self.lockbox_unlocked)

    def inventory_view(self):
        """The Inventory screen's rows: searched by name, then sorted. Both steps use
        Topic 5's InventoryTree (a BST) once it exists; a plain fallback keeps the
        game working if only the earlier topics have run."""
        by_name = {row[0]: row for row in self.inventory.rows(self.sell_price_for)}   # keyed by stack key
        tree_class = globals().get("InventoryTree")

        words = self.inv_query.lower().split()
        if words:                               # SEARCH: every typed word must start a word of the name
            if tree_class is not None:
                word_tree = tree_class()
                for name in by_name:
                    for word in stack_label(name).lower().split():   # "dried" and "tomato" both find Dried Tomato
                        word_tree.insert(word, name)
                hits = None
                for word in words:
                    found = set(word_tree.prefix_search(word))
                    hits = found if hits is None else hits & found
            else:
                hits = {n for n in by_name
                        if all(any(w.startswith(t) for w in stack_label(n).lower().split()) for t in words)}
            by_name = {n: row for n, row in by_name.items() if n in hits}

        if self.inv_sort in ("low", "high"):    # SORT by today's sell price
            if tree_class is not None:
                value_tree = tree_class()
                for name, row in by_name.items():
                    value_tree.insert(row[3], name)
                order = value_tree.inorder() if self.inv_sort == "low" else value_tree.reverse_inorder()
            else:
                order = sorted(by_name, key=lambda n: by_name[n][3], reverse=(self.inv_sort == "high"))
        else:                                   # RECENT: newest harvest first
            order = [n for n in reversed(self.inventory.recent) if n in by_name]
        return [by_name[name] for name in order]

    def page_rows(self, rows):
        """[key, emoji, qty, price, event modifier, plant name, mutation or "", mutation multiplier]"""
        out = []
        for key, emoji, qty, price in rows:
            name, mutation = split_key(key)
            out.append((key, emoji, qty, price, self.price_modifier(name),
                        name, mutation or "", MUTATION_MULTIPLIER.get(mutation, 1.0)))
        return out

    def refresh_inventory(self):
        updateInventory(self.page_rows(self.inventory_view()))
        self.refresh_raid()                 # the Magpie's forecast depends on what is in the Inventory

    def discard_from_inventory(self, name):
        qty = self.inventory.items.get(name, 0)
        if qty <= 0:
            return "You don't have any of that."
        self.inventory.take(name, qty)
        stack.push_action(f"Discarded {qty}x {stack_label(name)}")
        self.refresh_inventory()
        rescue = self.rescue_if_stuck()
        return f"Removed {qty}x {stack_label(name)} from your inventory. Nothing refunded." + (" " + rescue if rescue else "")

    def refresh_market(self):
        rows = self.market.rows(self.sell_price_for)
        updateMarket(self.page_rows(rows), self.market.total(self.sell_price_for))

    def sync_stamina(self):
        updateStamina(self.stamina, self.MAX_STAMINA)

    def sync_day(self):
        updateDay(self.day)


# ---- functions the page calls when the player acts ----
def handle_tile_click(row, col, tool, plant_name):
    if game.game_over:
        return "The blight took your garden. Press Restart to play again."
    if tool == "ward":
        return game.ward_at(row, col)
    if tool == "spray":
        return game.spray_at(row, col)
    if tool == "radar":
        return game.radar_at(row, col)
    if tool == "plant":
        return game.plant_at(row, col, plant_name)
    if tool == "water":
        return game.water_at(row, col)
    if tool == "harvest":
        return game.harvest_at(row, col)
    if tool == "shovel":
        return game.shovel_at(row, col)
    return f"Unknown tool: {tool}"

def sell_to_market_action(name):
    return game.sell_to_market(name)

def end_day_action():
    return game.end_day()

def inventory_view_action(sort_mode, query):
    game.inv_sort = sort_mode if sort_mode in ("recent", "low", "high") else "recent"
    game.inv_query = str(query or "")
    game.refresh_inventory()

def remove_from_inventory_action(name):
    return game.discard_from_inventory(name)

def buy_seed_action(name, qty=1):
    return game.merchant.buy_seed(name, qty)

def buy_water_action(amount):
    return game.merchant.buy_water(amount)

def buy_water_full_action():
    return game.merchant.buy_water_full()

def buy_ward_action(qty=1):
    return game.merchant.buy_ward(qty)

def buy_spray_action(qty=1):
    return game.merchant.buy_spray(qty)

def buy_lens_action(qty=1):
    return game.merchant.buy_lens(qty)

def use_lens_action():
    return game.merchant.use_lens()

def buy_lockbox_action():
    return game.merchant.buy_lockbox()

def buy_radar_action():
    return game.merchant.buy_radar()

def rescue_action():
    if game.game_over:
        return "The blight took your garden. Press Restart to play again."
    return game.rescue()

def quick_defend_action():
    if game.game_over:
        return "The blight took your garden. Press Restart to play again."
    return game.quick_defend()

def buy_tonic_action():
    return game.merchant.buy_stamina_tonic()

def use_tonic_action():
    return game.merchant.use_stamina_tonic()


STARTER_SEEDS = 2    # free seeds of each starter plant, to get the first harvest going

if "game" not in globals():
    starters = [Plant.from_data(name) for name, d in PLANT_DATA.items() if d["unlocked_by_default"]]
    game = GardenGame(
        catalog=starters,
        resources=Resources(water=200, coins=999),
    )
    for plant in starters:
        game.seed_counts[plant.name] = STARTER_SEEDS

game.refresh_dropdown()
game.refresh_shop()
game.resources.sync()
game.sync_stamina()
game.sync_day()
game.refresh_inventory()
game.refresh_market()
print(f"Master plant data ready: {len(PLANT_DATA)} plants across {len(TIER_ORDER)} tiers.")
print(f"Day {game.day}, Stamina {game.stamina}/{game.MAX_STAMINA}. "
      + f"Starters: " + ", ".join(p.name for p in game.catalog) + "\n")
print("Pick a tool (Plant / Water / Harvest / Shovel) and click a tile in the Interactive Sanctuary.")


# ===== TOPIC 4 =====
# Topic 4: Hierarchical Trees & Traversals

from collections import deque

if "game" not in globals():
    raise RuntimeError("Run the earlier topics first (Topic 3 sets up PLANT_DATA and the garden). Missing: game")

class PlantNode:
    def __init__(self, label, emoji=None, is_plant=False, plant_name=None):
        self.label = label
        self.emoji = emoji
        self.is_plant = is_plant
        self.plant_name = plant_name
        self.children = []

    def add_child(self, child):   # O(1)
        self.children.append(child)
        return child

    def preorder(self, depth=0, result=None):
        if result is None:
            result = []
        result.append((depth, self))
        for child in self.children:
            child.preorder(depth + 1, result)
        return result

    def inorder(self, depth=0, result=None):   # O(n)
        """n-ary in-order: the FIRST child's subtree, then this node, then the remaining
        children. On a binary tree this is exactly left -> node -> right."""
        if result is None:
            result = []
        if self.children:
            self.children[0].inorder(depth + 1, result)
        result.append((depth, self))
        for child in self.children[1:]:
            child.inorder(depth + 1, result)
        return result

    def postorder(self, depth=0, result=None):   # O(n)
        """Children first, then the node itself (tally() below uses the same order)."""
        if result is None:
            result = []
        for child in self.children:
            child.postorder(depth + 1, result)
        result.append((depth, self))
        return result

    def tally(self, unlocked_names):
        """Postorder: children counted before their parent; totals roll upward."""
        unlocked, total = 0, 0
        for child in self.children:
            child_unlocked, child_total = child.tally(unlocked_names)
            unlocked += child_unlocked
            total += child_total
        if self.is_plant:
            total += 1
            if self.plant_name in unlocked_names:
                unlocked += 1
        return unlocked, total

    def level_order(self):
        levels = []
        waiting = deque([(0, self)])
        while waiting:
            depth, node = waiting.popleft()   # O(1): front of the queue
            if depth == len(levels):
                levels.append([])
            levels[depth].append(node)
            for child in node.children:
                waiting.append((depth + 1, child))
        return levels

def _build_tier_node(color):
    node = PlantNode(color)
    for name in TIER_ORDER[color]:
        node.add_child(PlantNode(name, PLANT_DATA[name]["emoji"], is_plant=True, plant_name=name))
    for other_color, meta in COLOR_CHAINS.items():
        if meta["opens_after"] == color:
            node.add_child(_build_tier_node(other_color))
    return node

class PlantBook:
    def __init__(self, game):
        self.game = game
        self.root = self.build_tree()

    def build_tree(self):
        root = PlantNode("Plant Book")
        for color, meta in COLOR_CHAINS.items():
            if meta["depth"] == 0:
                root.add_child(_build_tier_node(color))
        return root

    def unlocked_names(self):
        return {plant.name for plant in self.game.catalog}

    def _requirement_note(self, name, unlocked_names):
        d = PLANT_DATA[name]
        if d["unlocked_by_default"]:
            return "Starter plant"
        if d["opens_after_tier"]:
            prereq_names = TIER_ORDER[d["opens_after_tier"]]
            have = sum(1 for n in prereq_names if n in unlocked_names)
            return f"Opens once every {d['opens_after_tier']} plant is unlocked ({have}/{len(prereq_names)})"
        names = TIER_ORDER[d["color"]]
        previous = names[d["position"] - 1]
        need = d["unlock_threshold"]
        have = min(need, self.game.harvest_counts.get(previous, 0))
        return f"Needs {need} harvests of {previous} ({have}/{need})"

    def rows(self):
        unlocked_names = self.unlocked_names()
        rows = []
        for depth, node in self.root.preorder():
            if depth == 0:
                continue
            if node.is_plant:
                note = self._requirement_note(node.plant_name, unlocked_names)
                unlocked = node.plant_name in unlocked_names
                rows.append((depth - 1, node.emoji, node.label, unlocked, note))
            else:
                unlocked, total = node.tally(unlocked_names)
                heart = COLOR_HEART.get(node.label, "🎨")
                rows.append((depth - 1, heart, f"{node.label} Tier", True, f"{unlocked}/{total} unlocked (incl. sub-tiers)"))
        return rows

    def _traversal_row(self, depth, node, unlocked_names):
        """[depth, emoji, label, unlocked, is_plant] for one visited node."""
        if node.is_plant:
            return [depth, node.emoji, node.label, node.plant_name in unlocked_names, True]
        if depth == 0:
            return [depth, "📖", node.label, True, False]
        return [depth, COLOR_HEART.get(node.label, "🎨"), f"{node.label} Tier", True, False]

    def traversal_orders(self):
        """Demo only: the SAME tree visited four ways, for the Traversal Compare view.
        Returns (bfs, preorder, inorder, postorder), each a list of rows in visit order."""
        unlocked_names = self.unlocked_names()

        def rows(pairs):
            return [self._traversal_row(depth, node, unlocked_names) for depth, node in pairs]

        bfs = [(depth, node) for depth, level in enumerate(self.root.level_order()) for node in level]
        return rows(bfs), rows(self.root.preorder()), rows(self.root.inorder()), rows(self.root.postorder())

    def label_of(self, node):
        """The name the page shows for a node (the root, a tier, or a plant)."""
        if node is self.root:
            return node.label
        return node.label if node.is_plant else f"{node.label} Tier"

    def walk(self, query, mode="dfs"):
        """Search BY TRAVERSAL: visit nodes in order and stop at the first one whose name
        contains the query. Returns (visited labels in order, path root -> match, or []).
          dfs = depth-first, preorder, driven by a STACK (Topic 1): pop the top, push its
                children in reverse so the first child is on top.
          bfs = breadth-first, level order, driven by a QUEUE (Topic 2): take from the front,
                add the children at the back.
        Each step is O(1), so the whole search is O(n) in the worst case (n = nodes)."""
        query = (query or "").strip().lower()
        breadth = (mode == "bfs")
        frontier = deque([self.root]) if breadth else [self.root]
        take = frontier.popleft if breadth else frontier.pop
        parent, visited, found = {}, [], None
        while query and frontier:
            node = take()
            visited.append(self.label_of(node))
            if node is not self.root and query in self.label_of(node).lower():
                found = node
                break
            for child in (node.children if breadth else reversed(node.children)):
                parent[id(child)] = node
                frontier.append(child)
        path = []
        while found is not None:                 # climb the parent links back up to the root
            path.append(self.label_of(found))
            found = parent.get(id(found))
        path.reverse()
        return visited, path

    def search(self, query, mode="dfs"):
        visited, path = self.walk(query, mode)
        if not visited:                          # empty search box: clear the highlight
            highlightPlantPath([], [], False, "")
            return
        total = len(self.root.preorder())
        how = "breadth-first" if mode == "bfs" else "depth-first"
        if path:
            message = (f"Found {path[-1]} after visiting {len(visited)} of {total} nodes ({how}). "
                       f"Path: {' > '.join(path)}")
        else:
            message = f"No match for \"{query.strip()}\": all {total} nodes visited ({how})."
        highlightPlantPath(visited, path, bool(path), message)

    def render(self):
        unlocked, total = self.root.tally(self.unlocked_names())
        renderPlantBook(self.rows(), unlocked, total)
        renderTraversalCompare(*self.traversal_orders())

    def print_levels(self):
        lines = []
        for depth, level in enumerate(self.root.level_order()):
            labels = [node.label for node in level]
            lines.append(f"Level {depth}: " + ", ".join(labels))
        print("Plant Book, level by level:\n" + "\n".join(lines) + "\n")

plant_book = PlantBook(game)
plant_book.render()
plant_book.print_levels()

def plant_book_search_action(query, mode):   # called by the Plant Book search box
    plant_book.search(query, mode)

_dfs_visits, _ = plant_book.walk("tulip", "dfs")
_bfs_visits, _ = plant_book.walk("tulip", "bfs")
print(f"Plant Book search for Tulip: depth-first (a stack) visits {len(_dfs_visits)} nodes, "
      f"breadth-first (a queue) visits {len(_bfs_visits)}. Both stop at the first match.\n")

unlocked, total = plant_book.root.tally(plant_book.unlocked_names())
print(f"Plant Book ready! {unlocked} of {total} plants unlocked. Open the Plant Book tab to see it.")
print("Traversal Compare ready! In the Plant Book tab, switch the toggle to compare BFS and DFS orders.")


# ===== TOPIC 5 =====
# Topic 5: Binary Search Trees (BST) & Node Mutation
#
# A BST keeps one rule at every node: everything in the LEFT subtree has a smaller key,
# everything in the RIGHT subtree has a larger (or equal) key. Here the KEY is a plant's
# seed price. That one rule makes these operations fast:
#   insert    walk down, going left or right, until an empty spot appears     O(log n) average
#   search    the same walk, stopping when the key matches                    O(log n) average
#   traverse  inorder lists the keys in sorted order                          O(n)
#   delete    remove a node and keep the rule true (three cases, below)       O(log n) average
# "Average" is the catch: it assumes the tree stays roughly balanced. Our plants unlock
# from cheap to expensive, so each new one lands on the right and the tree leans into a
# chain (see the note at the bottom). That is the case for AVL and Red-Black trees.
#
# NODE MUTATION: every node holds two kinds of data.
#   - the KEY (cost): decides where the node sits. Never change it in place, or the
#     tree can silently stop being a BST (a demo below shows exactly that).
#   - the PAYLOAD (modifier, expires_on): today's price multiplier. Events change it
#     IN PLACE - same node, same position, no re-insert - and the sell price follows.

if "game" not in globals():
    raise RuntimeError("Run the earlier topics first (Topic 3 sets up PLANT_DATA and the garden). Missing: game")


class PriceNode:
    def __init__(self, cost, name):
        self.cost = cost            # KEY: the seed price. Fixed.
        self.name = name
        self.modifier = 1.0         # PAYLOAD: sell-price multiplier (events change this)
        self.expires_on = None      # PAYLOAD: the day the modifier goes back to 1.0
        self.left = None
        self.right = None


class PlantPriceBST:
    """Every unlocked plant, ordered by seed price. Equal prices go to the right.
    Plants also tend to unlock from cheap to expensive, so new ones keep landing on
    the right and the tree leans toward a chain."""

    def __init__(self):
        self.root = None

    # ---- insert ----
    def insert(self, cost, name):   # O(log n) average, O(n) worst case
        self.root = self._insert(self.root, cost, name)

    def _insert(self, node, cost, name):
        if node is None:
            return PriceNode(cost, name)
        if cost < node.cost:
            node.left = self._insert(node.left, cost, name)
        else:   # cost >= node.cost: equal costs go right, so no plant is ever lost
            node.right = self._insert(node.right, cost, name)
        return node

    # ---- search ----
    def find_with_steps(self, cost):   # O(log n) average, O(n) worst case
        """Walk down from the root. Returns (node or None, how many nodes were compared)."""
        node, steps = self.root, 0
        while node is not None:
            steps += 1
            if cost == node.cost:
                return node, steps
            node = node.left if cost < node.cost else node.right
        return None, steps

    def search(self, cost):
        return self.find_with_steps(cost)[0]

    def find(self, name):   # look a plant up by name: its seed price is the key
        return self.search(PLANT_DATA[name]["cost"])

    # ---- node mutation ----
    def mutate(self, name, factor, expires_on=None):
        """Change a node's PAYLOAD in place. Its position in the tree never changes."""
        node = self.find(name)
        if node is None:
            return None
        node.modifier = factor
        node.expires_on = expires_on
        return node

    def tick(self, today):
        """Reset every modifier whose time is up. An inorder walk visits every node."""
        back_to_normal = []
        for node in self.inorder():
            if node.expires_on is not None and today >= node.expires_on:
                node.modifier, node.expires_on = 1.0, None
                back_to_normal.append(node.name)
        return back_to_normal

    def shifted(self):   # the nodes whose price an event is currently moving
        return [node for node in self.inorder() if node.modifier != 1.0]

    # ---- delete ----
    def delete(self, cost):   # O(log n) average, O(n) worst case
        """Remove the node with this key. Returns True if one was removed."""
        self.root, removed = self._delete(self.root, cost)
        return removed

    def _delete(self, node, cost):
        if node is None:
            return None, False
        if cost < node.cost:
            node.left, removed = self._delete(node.left, cost)
            return node, removed
        if cost > node.cost:
            node.right, removed = self._delete(node.right, cost)
            return node, removed
        # Found it. Three cases:
        if node.left is None:          # 1) a leaf, or only a right child: the child takes its place
            return node.right, True
        if node.right is None:         # 2) only a left child
            return node.left, True
        successor = node.right         # 3) two children: copy in the next-larger node (the smallest
        while successor.left is not None:   #    one on the right side) - a node mutation - then delete that one
            successor = successor.left
        node.cost, node.name = successor.cost, successor.name
        node.modifier, node.expires_on = successor.modifier, successor.expires_on
        node.right, _ = self._delete(node.right, successor.cost)
        return node, True

    # ---- the three traversals ----
    def inorder(self):   # O(n): left, node, right
        result = []
        self._inorder(self.root, result)
        return result

    def _inorder(self, node, result):
        if node is None:
            return
        self._inorder(node.left, result)
        result.append(node)
        self._inorder(node.right, result)

    def preorder(self):   # O(n): node, left, right
        result = []
        self._preorder(self.root, result)
        return result

    def _preorder(self, node, result):
        if node is None:
            return
        result.append(node)
        self._preorder(node.left, result)
        self._preorder(node.right, result)

    def postorder(self):   # O(n): left, right, node
        result = []
        self._postorder(self.root, result)
        return result

    def _postorder(self, node, result):
        if node is None:
            return
        self._postorder(node.left, result)
        self._postorder(node.right, result)
        result.append(node)

    def height(self):   # O(n): how many levels deep the tree actually is
        return self._height(self.root)

    def _height(self, node):
        if node is None:
            return 0
        return 1 + max(self._height(node.left), self._height(node.right))

    def is_valid(self):   # a tree is a BST exactly when its inorder keys come out sorted
        keys = [node.cost for node in self.inorder()]
        return all(a <= b for a, b in zip(keys, keys[1:]))


class InventoryNode:
    def __init__(self, key, name):
        self.key = key          # a sell price (int) or a lowercase word from a plant's name (str)
        self.name = name        # the plant this entry points to
        self.left = None
        self.right = None


class InventoryTree:
    """A small BST the Inventory screen builds each time it redraws. Equal keys go right.
    Keyed by sell price it gives lowest-first (inorder) and highest-first (reverse
    inorder). Keyed by name words it answers 'which names start with these letters?'
    without looking at every plant. The keys are only set at insert time and never
    edited, so the tree always stays a valid BST."""

    def __init__(self):
        self.root = None

    def insert(self, key, name):   # O(log n) average, O(n) worst case
        self.root = self._insert(self.root, key, name)

    def _insert(self, node, key, name):
        if node is None:
            return InventoryNode(key, name)
        if key < node.key:
            node.left = self._insert(node.left, key, name)
        else:
            node.right = self._insert(node.right, key, name)
        return node

    def inorder(self):   # O(n): ascending keys
        out = []
        def walk(node):
            if node is not None:
                walk(node.left); out.append(node.name); walk(node.right)
        walk(self.root)
        return out

    def reverse_inorder(self):   # O(n): right, node, left = descending keys
        out = []
        def walk(node):
            if node is not None:
                walk(node.right); out.append(node.name); walk(node.left)
        walk(self.root)
        return out

    def prefix_search(self, prefix):   # O(log n + k) on a balanced tree, k = matches
        """Names whose key starts with prefix. Every match lies in the key range
        [prefix, prefix + a huge character), so whole subtrees outside it are skipped."""
        low, high, out = prefix, prefix + "\uffff", []
        def walk(node):
            if node is None:
                return
            if low < node.key:        # the left side can still hold keys >= low
                walk(node.left)
            if node.key.startswith(prefix):
                out.append(node.name)
            if node.key < high:       # the right side can still hold keys < high
                walk(node.right)
        walk(self.root)
        return out


def _build_price_bst():
    tree = PlantPriceBST()
    for plant in game.catalog:   # inserted in catalog order: unlock order, not sorted order
        tree.insert(plant.cost, plant.name)
    return tree


# The game's own tree is built once and then kept: new plants are INSERTED when they
# unlock (GardenGame.add_to_catalog), and events MUTATE nodes in place.
# Re-running this topic keeps it, so a price shift in progress survives.
if "price_bst" not in globals():
    price_bst = _build_price_bst()

inorder_nodes = price_bst.inorder()
preorder_nodes = price_bst.preorder()
postorder_nodes = price_bst.postorder()

# Inorder does real work here: GardenGame.sorted_catalog() reads this tree with an
# inorder walk, so the Seed Bag comes out cheapest-first with no separate sorting code.
game.refresh_dropdown()
game.refresh_inventory()
game.refresh_market()

print(f"Plant Price BST ready: {len(inorder_nodes)} plants, tree height {price_bst.height()}.\n")

print("INORDER (ascending by cost - this is the Seed Bag order):")
print("  " + " -> ".join(f"{n.name}({n.cost:,}c)" for n in inorder_nodes) + "\n")

print("PREORDER (backup sequence - replay these inserts to rebuild the exact same tree):")
print("  " + " -> ".join(f"{n.name}({n.cost:,}c)" for n in preorder_nodes) + "\n")

print("POSTORDER (safe teardown order - children cleared before their parent):")
print("  " + " -> ".join(f"{n.name}({n.cost:,}c)" for n in postorder_nodes) + "\n")


# ---- Demos on a SCRATCH tree: the game's own tree is never touched here ----
def _scratch_tree():
    tree = PlantPriceBST()
    # inserted middle-first so this little tree comes out balanced:
    #            Apple 48
    #      Lettuce 27     Onion 87
    #    Tomato 20  Potato 36   Cucumber 65  Strawberry 115
    for name in ("Apple", "Lettuce", "Onion", "Tomato", "Potato", "Cucumber", "Strawberry"):
        tree.insert(PLANT_DATA[name]["cost"], name)
    return tree


def _names(tree):
    return ", ".join(n.name for n in tree.inorder())


demo = _scratch_tree()
found, steps = demo.find_with_steps(PLANT_DATA["Potato"]["cost"])
print(f"SEARCH: Potato ({found.cost}c) found after {steps} comparisons in a 7-plant tree; scanning a list could take up to 7.\n")
nothing, steps = demo.find_with_steps(99)
print(f"        A 99c plant: not found after {steps} comparisons.\n")

onion = demo.find("Onion")
demo.mutate("Onion", 1.3, expires_on=4)
print(f"MUTATION, the PAYLOAD: Onion's modifier is now x{onion.modifier}. Same node object: {demo.find('Onion') is onion}. "
      f"Still a valid BST: {demo.is_valid()}.\n")
onion.cost = 5   # the WRONG way: changing the KEY in place
print(f"MUTATION, the KEY (wrong): Onion's price changed to 5c in place. Still a valid BST: {demo.is_valid()}. "
      f"Searching for 5c finds: {demo.search(5)} - Onion is now unreachable.\n")

demo = _scratch_tree()
demo.delete(PLANT_DATA["Tomato"]["cost"])
print(f"DELETE a leaf (Tomato):          {_names(demo)} | valid: {demo.is_valid()}\n")
demo.delete(PLANT_DATA["Lettuce"]["cost"])
print(f"DELETE one child (Lettuce):      {_names(demo)} | valid: {demo.is_valid()}\n")
demo.delete(PLANT_DATA["Apple"]["cost"])
print(f"DELETE two children (Apple, root): {_names(demo)} | valid: {demo.is_valid()} | new root: {demo.root.name}\n")
print("        (delete is here to complete the BST toolkit; the game itself never removes a plant from its price tree.)\n")

shifted = price_bst.shifted()
if shifted:
    print("PRICES SHIFTING NOW: " + ", ".join(f"{n.name} x{n.modifier} until day {n.expires_on}" for n in shifted) + "\n")
else:
    print("No prices are shifting right now. Festival Demand and Market Glut events mutate one color tier's nodes (x1.3 / x0.75 for 3 days).\n")

ideal_height = len(inorder_nodes).bit_length()   # roughly log2(n) + 1, a balanced tree's height
if price_bst.height() > ideal_height + 1:
    print(f"Note: tree height is {price_bst.height()}, but a balanced tree holding "
          f"{len(inorder_nodes)} plants would only need about {ideal_height}. Plants "
          f"tend to unlock from cheap to expensive, so each new one lands to the right of the "
          f"last (equal prices would do the same, since ties go right) and the tree leans into "
          f"a chain rather than staying bushy. "
          f"That's the real-world case for self-balancing trees (AVL, Red-Black) - out of "
          f"scope for this topic, but this is exactly the problem they solve.")

# ---- The Inventory screen uses InventoryTree too (rebuilt on every redraw) ----
_words = InventoryTree()
for _name in ("Sweet Potato", "Potato", "Tomato", "Tulip", "Tangerine"):
    for _word in _name.lower().split():
        _words.insert(_word, _name)
print("\n\nINVENTORY SEARCH: typing 'to' asks the name tree for keys in the range ['to', 'to'+max). "
      + f"Matches: {', '.join(_words.prefix_search('to'))}. "
      + "Whole branches outside that range are skipped, instead of reading every name.\n")
print("INVENTORY SORT: the same tree keyed by sell price. Inorder = lowest first, reverse inorder = highest first.\n")


# ===== TOPIC 6 =====
# Topic 6: Hash Tables, Collisions, & Rehashing
#
# THE WARD REGISTRY. Every "is there a Ward on this tile?" question in the night system is
# answered by a hash table written from scratch below. A hash function turns a tile number into
# a bucket number, so a lookup only has to look in ONE bucket instead of searching every Ward.
# Two tiles can land in the same bucket (a COLLISION); each bucket is a small list, so they just
# share it (separate chaining). When the table gets crowded it REHASHES: it builds a bigger table
# and re-inserts everything so the chains get short again.
# (Python's own dict and set are hash tables too. This is the same idea, built by hand.)

def multiplicative_hash(key):
    """Multiply by a large odd constant (Knuth's 2654435761 = 2^32 / the golden ratio), keep the
    low 32 bits, then fold the high half onto the low half so EVERY bit of the key influences the
    low bits that the bucket number is taken from. Without that last fold, tiles that are
    multiples of 8 would all land in the same bucket of an 8-bucket table."""
    mixed = (key * 2654435761) & 0xFFFFFFFF
    return mixed ^ (mixed >> 16)


class HashTable:
    """A hash table with SEPARATE CHAINING: each bucket is a list of [key, value] entries.
      put/get/remove: O(1) on average while chains stay short, O(n) if everything collides.
      Rehashing: when entries / buckets passes max_load, double the buckets and re-insert all."""

    def __init__(self, size=8, hash_function=multiplicative_hash, max_load=0.75):
        self.initial_size = size
        self.hash_function = hash_function
        self.max_load = max_load
        self.clear()

    def clear(self):
        self.buckets = [[] for _ in range(self.initial_size)]
        self.count = 0
        self.collisions = 0     # inserts that landed in a bucket that was already in use
        self.rehashes = 0
        self.steps = 0          # entries examined by lookups, to compare good and bad hash functions

    def _bucket(self, key):
        return self.buckets[self.hash_function(key) % len(self.buckets)]

    def put(self, key, value):
        """Add or update. Returns True if the key is new."""
        bucket = self._bucket(key)
        for entry in bucket:
            if entry[0] == key:
                entry[1] = value
                return False
        if bucket:
            self.collisions += 1
        bucket.append([key, value])
        self.count += 1
        if self.count / len(self.buckets) > self.max_load:
            self._rehash(len(self.buckets) * 2)
        return True

    def get(self, key, default=None):
        for entry in self._bucket(key):
            self.steps += 1
            if entry[0] == key:
                return entry[1]
        return default

    def contains(self, key):
        for entry in self._bucket(key):
            self.steps += 1
            if entry[0] == key:
                return True
        return False

    def remove(self, key):
        """Returns True if the key was there. (With chaining, removing is just deleting from a list.)"""
        bucket = self._bucket(key)
        for index, entry in enumerate(bucket):
            self.steps += 1
            if entry[0] == key:
                del bucket[index]
                self.count -= 1
                return True
        return False

    def _rehash(self, new_size):
        """The bucket number depends on the number of buckets, so every entry must be re-placed."""
        entries = [entry for bucket in self.buckets for entry in bucket]
        self.buckets = [[] for _ in range(new_size)]
        for key, value in entries:
            self._bucket(key).append([key, value])
        self.rehashes += 1

    def items(self):
        return [(key, value) for bucket in self.buckets for key, value in bucket]

    def load_factor(self):
        return self.count / len(self.buckets)

    def bucket_sizes(self):
        return [len(bucket) for bucket in self.buckets]


class WardRegistry(HashTable):
    """The night system's record of where the Wards are: tile number -> the day it was placed.
    It looks and behaves like a Python set of tile numbers (add, discard, in, len, |, <=),
    so the rest of the night code did not have to change, but it is really a HashTable."""

    def __init__(self, clock=lambda: 0):
        self.clock = clock                    # asked for today's day number when a Ward is added
        super().__init__()

    # ---- set-like behaviour ----
    def add(self, pos):
        if not self.contains(pos):
            self.put(pos, self.clock())

    def discard(self, pos):
        self.remove(pos)

    def update(self, positions):
        for pos in positions:
            self.add(pos)

    def day_placed(self, pos):
        return self.get(pos)

    def __contains__(self, pos):
        return self.contains(pos)

    def __iter__(self):
        return iter([key for key, _ in self.items()])

    def __len__(self):
        return self.count

    def __ior__(self, other):
        self.update(other)
        return self

    def __or__(self, other):
        return set(self) | set(other)

    __ror__ = __or__

    def __and__(self, other):
        return set(self) & set(other)

    __rand__ = __and__

    def __sub__(self, other):
        return set(self) - set(other)

    def __rsub__(self, other):
        return set(other) - set(self)

    def __eq__(self, other):
        return set(self) == set(other)

    def __le__(self, other):
        return set(self) <= set(other)

    def __ge__(self, other):
        return set(self) >= set(other)

    __hash__ = None

    # ---- the page's Registry panel ----
    def publish(self, barrier=()):
        bridge = globals().get("updateRegistry")
        if bridge is None:
            return
        rows = [(pos, day, "barrier" if pos in barrier else "lone") for pos, day in sorted(self.items())]
        bridge(rows, len(self.buckets), self.count, round(100 * self.load_factor()),
               self.collisions, self.rehashes, self.bucket_sizes())


# ---- console demonstration (scratch tables, so the game is untouched) ----
_tiles = [(i * 7) % 100 for i in range(1, 31)]               # 30 Wards at scattered tiles
_good = HashTable()
_growth = []
for _tile in _tiles:
    _before = len(_good.buckets)
    _good.put(_tile, 1)
    if len(_good.buckets) != _before:
        _growth.append(f"Ward #{_good.count} pushed the load past 75%, so {_before} buckets became {len(_good.buckets)}")
print("TOPIC 6 - the Ward Registry. Inserting 30 Wards into a table that starts with 8 buckets: "
      + "; ".join(_growth) + f". Final: {len(_good.buckets)} buckets, load {_good.load_factor():.0%}, "
      f"{_good.collisions} collisions along the way.\n\n")
_bad = HashTable(hash_function=lambda key: 0)                 # a hash function that ignores the key
for _tile in _tiles:
    _bad.put(_tile, 1)
_good.steps = _bad.steps = 0
for _tile in _tiles:
    _good.contains(_tile)
    _bad.contains(_tile)
print(f"GOOD HASH vs BAD HASH: looking up all 30 Wards took {_good.steps} entry checks with the real hash function "
      f"(about {_good.steps / 30:.1f} each) but {_bad.steps} with a hash that sends every key to bucket 0 "
      f"(about {_bad.steps / 30:.1f} each): one giant chain, so the 'hash table' degrades into a linear scan, O(n). "
      f"Its longest chain is {max(_bad.bucket_sizes())} against {max(_good.bucket_sizes())} for the good table.\n\n")
_before = _good.count
for _tile in _tiles[:10]:
    _good.remove(_tile)
print(f"REMOVING: deleting 10 Wards left {_good.count} of {_before}. With chaining a removal is just deleting an entry from "
      "one bucket's list; the table does not shrink. (Open addressing would need 'tombstones' to remove safely.)\n\n")



# ===== TOPIC 7 =====
# Topic 7: Graph Foundations, Adjacency Matrices/Lists, & DFS/BFS
#
# THE NIGHT DEFENSE SYSTEM, part 1: the Crawling Blight and the Wards.
# The garden is a GRAPH. The blight spreads across it with BFS, one ring per night, and the
# Wards you place decide with DFS whether they form a barrier that holds. Both results change
# the real game: which tiles die, and which Wards survive the night.
from collections import deque

# ---- tuning knobs (Lead Architect: change these to rebalance the night) ----
FIRST_BLIGHT_NIGHT = 5          # the blight first appears when this day ends
WARD_REACH = 2                  # an infected plant can destroy Wards up to this many tiles away (a 5 x 5 square)
BARRIER_SIZE = 3                # connected Wards needed to form a barrier that blight cannot cross
PLANTS_PER_EXTRA_SOURCE = 30    # each night 1 new blight source appears, plus 1 per this many plants


class GardenGraph:
    """The garden as a GRAPH. Every tile is a vertex, numbered like the page does
    (row x 10 + col). Two tiles are joined by an edge when they share a side.

    It is stored as an ADJACENCY LIST: a dict that maps each tile to the list of its
    neighbours. A garden is SPARSE (each tile touches only 2 to 4 others), so a list
    needs about 2 x 180 entries where an adjacency matrix would need 100 x 100 = 10,000 cells."""

    SIDES = ((-1, 0), (1, 0), (0, -1), (0, 1))
    SIDES_AND_CORNERS = SIDES + ((-1, -1), (-1, 1), (1, -1), (1, 1))

    def __init__(self, rows, cols):
        self.rows, self.cols = rows, cols
        # Blight spreads across SIDES only...
        self.adj = {pos: self._around(pos, self.SIDES) for pos in range(rows * cols)}
        # ...so a wall of Wards that touches only at its CORNERS still seals every gap.
        self.adj8 = {pos: self._around(pos, self.SIDES_AND_CORNERS) for pos in range(rows * cols)}

    def _around(self, pos, moves):
        row, col = divmod(pos, self.cols)
        return [(row + dr) * self.cols + (col + dc) for dr, dc in moves
                if 0 <= row + dr < self.rows and 0 <= col + dc < self.cols]

    def edge_count(self):
        return sum(len(neighbours) for neighbours in self.adj.values()) // 2

    def matrix(self):
        """The same graph as an ADJACENCY MATRIX (a 2D list). Built only to compare."""
        size = self.rows * self.cols
        grid = [[0] * size for _ in range(size)]
        for pos, neighbours in self.adj.items():
            for other in neighbours:
                grid[pos][other] = 1
        return grid

    def bfs(self, sources, max_depth=None, blocked=lambda pos: False):
        """BREADTH-FIRST SEARCH: visit every tile within max_depth steps of the sources,
        nearest first, using a QUEUE (Topic 2). Returns {tile: distance in steps}.
        All tiles at distance 1 are found before any at distance 2 - that is a "ring".
        Each tile and edge is looked at once: O(V + E)."""
        distance = {pos: 0 for pos in sources}
        queue = deque(sources)
        while queue:
            pos = queue.popleft()
            if max_depth is not None and distance[pos] >= max_depth:
                continue
            for neighbour in self.adj[pos]:
                if neighbour in distance or blocked(neighbour):
                    continue
                distance[neighbour] = distance[pos] + 1
                queue.append(neighbour)
        return distance

    def dfs_groups(self, tiles):
        """DEPTH-FIRST SEARCH over just the given tiles (and their side-or-corner
        neighbours). It follows one chain as far as it goes before backing up, using a
        STACK (Topic 1), and returns the connected groups. O(V + E) over those tiles."""
        tiles = set(tiles)
        seen, groups = set(), []
        for start in sorted(tiles):
            if start in seen:
                continue
            seen.add(start)
            pile, group = [start], []
            while pile:
                pos = pile.pop()                       # take the newest: go deep first
                group.append(pos)
                for neighbour in self.adj8[pos]:
                    if neighbour in tiles and neighbour not in seen:
                        seen.add(neighbour)
                        pile.append(neighbour)
            groups.append(sorted(group))
        return groups


class NightDefense:
    """Owns the night rules: where the blight is, where the Wards are, and what happens
    when a day ends. GardenGame asks it before every tile action (see GardenGame._night_lock).

      blight : set of tiles covered by blight. A plant on one is INFECTED.
      wards  : set of tiles holding a Ward.
      barrier: the Wards that belong to a group of BARRIER_SIZE or more (found by DFS)."""

    def __init__(self, game):
        self.game = game
        self.graph = GardenGraph(game.grid.rows, game.grid.cols)
        self.blight = set()
        # the Wards live in Topic 6's hash table (a plain set if Topic 6 hasn't run)
        self.wards = WardRegistry(lambda: game.day) if "WardRegistry" in globals() else set()
        self.barrier = set()
        self.blight_seen = False

    # ---- reading the board ----
    def pos(self, row, col):
        return self.game.grid.to_position(row, col)

    def rc(self, pos):
        return divmod(pos, self.game.grid.cols)

    def has_ward(self, row, col):
        return self.pos(row, col) in self.wards

    def lock_message(self, row, col):
        """Why an ordinary tile action can't happen here ('' when it can)."""
        pos = self.pos(row, col)
        if pos in self.blight:
            plant = self.game.grid.cells[row][col]
            if plant is not None:
                return f"The {plant.name} is infected. Only Cleansing Spray can save it."
            return "Blight covers that tile. Only Cleansing Spray can clear it."
        if pos in self.wards:
            return "A Ward stands there. Use the Shovel to remove it."
        return ""

    def tile_look(self, row, col):
        """(name, stage) the page should draw for a Ward, Blight or infected plant, else None."""
        pos = self.pos(row, col)
        if pos in self.wards:
            return ("Ward", "barrier" if pos in self.barrier else "ward")
        if pos in self.blight:
            plant = self.game.grid.cells[row][col]
            if plant is not None:
                return (plant.name, "infected-" + plant.stage)
            return ("Blight", "blight")
        return None

    def recompute_barrier(self):
        """Which Wards hold? Group them with DFS; a group of BARRIER_SIZE or more is a barrier."""
        groups = self.graph.dfs_groups(self.wards)
        self.barrier = {pos for group in groups if len(group) >= BARRIER_SIZE for pos in group}
        return groups

    def redraw(self, positions):
        for pos in positions:
            self.game.grid.redraw(*self.rc(pos))
        publish = getattr(self.wards, "publish", None)
        if publish is not None:
            publish(self.barrier)           # keep the Registry panel in step with the Wards

    # ---- the player's two night tools ----
    def place_ward(self, row, col):
        game = self.game
        if not game.grid.in_bounds(row, col):
            return "That tile is outside the garden."
        locked = self.lock_message(row, col)
        if locked:
            return locked
        if not game.grid.is_empty(row, col):
            return "A Ward needs bare ground. Shovel the plant first."
        if game.wards_owned <= 0:
            return "You don't have any Wards. Merchant Marco sells them."
        stamina_msg = game.spend_stamina("ward")
        if stamina_msg:
            return stamina_msg
        game.wards_owned -= 1
        pos = self.pos(row, col)
        self.wards.add(pos)
        groups = self.recompute_barrier()
        size = next(len(group) for group in groups if pos in group)
        self.redraw(self.wards)
        stack.push_action(f"Placed a Ward at ({row}, {col})")
        game.refresh_shop()
        game.refresh_predator()
        if pos in self.barrier:
            note = f" It is part of a barrier of {size} Wards: blight cannot cross it."
        else:
            note = (f" It is linked to {size} Ward(s); {BARRIER_SIZE} linked Wards (touching at a side or "
                    f"a corner) make a barrier. Until then the blight breaks it.")
        tired = game._tired_notice()
        return "Placed a Ward." + note + (" " + tired if tired else "")

    def remove_ward(self, row, col):
        game = self.game
        stamina_msg = game.spend_stamina("shovel")
        if stamina_msg:
            return stamina_msg
        pos = self.pos(row, col)
        self.wards.discard(pos)
        self.recompute_barrier()
        self.redraw(self.wards | {pos})
        stack.push_action(f"Removed the Ward at ({row}, {col}) with the shovel")
        game.refresh_predator()
        tired = game._tired_notice()
        return tired or "Removed the Ward. No refund."

    def spray(self, row, col):
        game = self.game
        if not game.grid.in_bounds(row, col):
            return "That tile is outside the garden."
        pos = self.pos(row, col)
        if pos not in self.blight:
            return "That tile isn't blighted."
        if game.sprays_owned <= 0:
            return "You don't have any Cleansing Spray. Merchant Marco sells it."
        stamina_msg = game.spend_stamina("spray")
        if stamina_msg:
            return stamina_msg
        game.sprays_owned -= 1
        self.blight.discard(pos)
        plant = game.grid.cells[row][col]
        if plant is not None:
            plant.infected = False
        game.grid.redraw(row, col)
        stack.push_action(f"Cleansed the tile at ({row}, {col})")
        game.refresh_shop()
        game.refresh_predator()
        game.refresh_triage()
        tired = game._tired_notice()
        what = f"Cleansed the tile - the {plant.name} recovered." if plant is not None else "Cleansed the tile."
        return what + (" " + tired if tired else "")

    # ---- the night itself ----
    def edge_tiles(self):
        rows, cols = self.game.grid.rows, self.game.grid.cols
        return [pos for pos in range(rows * cols)
                if self.rc(pos)[0] in (0, rows - 1) or self.rc(pos)[1] in (0, cols - 1)]

    def new_source_count(self):
        planted = sum(1 for _ in self.game.grid.each_plant())
        return 1 + planted // PLANTS_PER_EXTRA_SOURCE

    def run_night(self, day):
        """Called by GardenGame.end_day for the night that ends `day`. Returns a report ('' if quiet).
          1. SPREAD (BFS): every blighted tile infects the tiles beside it - one ring.
             Barrier Wards stop it; a Ward that is not part of a barrier breaks and is taken over.
          2. NEW SOURCES: fresh blight appears on random edge tiles.
          3. INFECTED PLANTS (the ones infected before tonight) each destroy one random Ward in reach."""
        if day < FIRST_BLIGHT_NIGHT:
            return ""
        game, grid = self.game, self.game.grid
        infected_before = [pos for pos in sorted(self.blight) if grid.cells[self.rc(pos)[0]][self.rc(pos)[1]] is not None]

        reached = []
        if self.blight:
            ring = self.graph.bfs(sorted(self.blight), max_depth=1, blocked=lambda pos: pos in self.barrier)
            reached = [pos for pos, steps in ring.items() if steps == 1]
        free_edge = [pos for pos in self.edge_tiles()
                     if pos not in self.blight and pos not in self.wards and pos not in reached]
        sources = random.sample(free_edge, min(self.new_source_count(), len(free_edge)))
        reached += sources

        broken = infected_now = 0
        for pos in reached:
            if pos in self.wards:
                self.wards.discard(pos)
                broken += 1
            self.blight.add(pos)
            row, col = self.rc(pos)
            plant = grid.cells[row][col]
            if plant is not None and not plant.infected:
                plant.infected = True
                infected_now += 1

        struck = 0
        for pos in infected_before:
            row, col = self.rc(pos)
            near = [ward for ward in sorted(self.wards)
                    if abs(self.rc(ward)[0] - row) <= WARD_REACH and abs(self.rc(ward)[1] - col) <= WARD_REACH]
            if near:
                self.wards.discard(random.choice(near))
                struck += 1

        self.recompute_barrier()
        self.redraw(set(reached) | self.wards | set(infected_before))

        if not reached and not struck:
            return ""
        parts = []
        if not self.blight_seen:
            parts.append("The Crawling Blight has appeared on the edge of your garden!")
            self.blight_seen = True
        parts.append(f"Overnight the blight covered {len(reached)} tile(s)"
                     + (f" and infected {infected_now} plant(s)" if infected_now else "") + ".")
        if broken:
            parts.append(f"{broken} Ward(s) broke.")
        if struck:
            parts.append(f"Infected plants destroyed {struck} Ward(s).")
        return " ".join(parts)

    def garden_wiped(self):
        return len(self.blight) >= self.game.grid.rows * self.game.grid.cols

    def end_game(self):
        self.game.game_over = True
        text = "GAME OVER: the blight covered every tile of your garden."
        stack.push_action(text)
        bridge = globals().get("showGameOver")
        if bridge is not None:
            bridge("The blight took your garden. Every tile is covered, so nothing can ever grow here again.")
        return text


if "night_defense" not in globals():
    night_defense = NightDefense(game)

# ---- console demonstration (on a scratch graph, so it never touches the game) ----
_g = GardenGraph(10, 10)
print("TOPIC 7 - the garden as a graph: "
      f"{len(_g.adj)} tiles (vertices) and {_g.edge_count()} edges (shared sides).\n\n")
print("Adjacency LIST: tile 0 (a corner) -> " + str(_g.adj[0]) + ", tile 5 (an edge) -> " + str(_g.adj[5])
      + ", tile 55 (the middle) -> " + str(_g.adj[55]) + ". "
      + f"{sum(len(n) for n in _g.adj.values())} entries in all.\n\n")
_m = _g.matrix()
print(f"Adjacency MATRIX: {len(_m)} x {len(_m)} = {len(_m) ** 2:,} cells, almost all 0. Asking 'are 54 and 55 "
      f"neighbours?' is O(1) in the matrix ({bool(_m[54][55])}) but the list needs a short scan ({55 in _g.adj[54]}). "
      "Each tile has only 2 to 4 neighbours, so the list wins on memory - which is why the game uses it.\n\n")
_rings = {}
for _tile, _steps in _g.bfs([45]).items():
    _rings[_steps] = _rings.get(_steps, 0) + 1
print("BFS from tile 45 finds the garden ring by ring: tiles at each distance = "
      + str([_rings[d] for d in sorted(_rings)][:6]) + " ... Overnight the blight advances exactly one ring.\n\n")
_demo = _g.dfs_groups({11, 22, 33, 60, 61, 99})
print("DFS on a sample set of Wards {11, 22, 33, 60, 61, 99} finds the groups " + str(_demo)
      + f". Groups of {BARRIER_SIZE}+ are barriers: {[g for g in _demo if len(g) >= BARRIER_SIZE]}. "
      "11, 22 and 33 touch only at corners, and still count (blight only crosses sides).\n\n")
print("BFS and DFS both visit every tile and edge once: O(V + E). Here that is at most 100 + 180 steps.\n\n")



# ===== TOPIC 8 =====
# Topic 8: Sorting Algorithms (Bubble, Insertion, Selection, Quick, & Merge Sort)
#
# THE NIGHT DEFENSE SYSTEM, part 3: Rescue Triage.
# After a blight night there may be more infected plants than Cleansing Sprays. The Triage Board
# sorts the infected plants by how much they are worth, and the Rescue button cures the top of
# that list. All five sorts are written from scratch below (no sorted()), each counting the work
# it does, so the board can show what each one would have cost on today's list.

RESCUE_SORT = "Merge"          # the sort Rescue uses (any name in SORTS works)
RESCUE_SPRAYS = 3              # most Sprays one Rescue will spend
STAGE_RANK = {"seed": 0, "seedling": 1, "sprout": 2, "mature": 3}


class SortStats:
    """What a sort did: how many times it compared two items, and how many items it moved."""
    def __init__(self):
        self.comparisons = 0
        self.swaps = 0


def _less(stats, key, a, b):
    stats.comparisons += 1
    return key(a) < key(b)


def bubble_sort(items, key):
    """Compare neighbours and swap them if they are out of order; after each pass the biggest
    unsorted item has "bubbled" to the end. Stops early if a pass swaps nothing. O(n^2). Stable."""
    data, stats = list(items), SortStats()
    for end in range(len(data) - 1, 0, -1):
        swapped = False
        for i in range(end):
            if _less(stats, key, data[i + 1], data[i]):
                data[i], data[i + 1] = data[i + 1], data[i]
                stats.swaps += 1
                swapped = True
        if not swapped:
            break
    return data, stats


def selection_sort(items, key):
    """Find the smallest remaining item and swap it to the front. Always O(n^2) comparisons, but
    at most n - 1 swaps. NOT stable: that long-distance swap can jump an item over its equals."""
    data, stats = list(items), SortStats()
    for i in range(len(data) - 1):
        smallest = i
        for j in range(i + 1, len(data)):
            if _less(stats, key, data[j], data[smallest]):
                smallest = j
        if smallest != i:
            data[i], data[smallest] = data[smallest], data[i]
            stats.swaps += 1
    return data, stats


def insertion_sort(items, key):
    """Take the next item and slide it left until it fits, like sorting a hand of cards.
    O(n^2) in the worst case but close to O(n) when the list is nearly sorted. Stable."""
    data, stats = list(items), SortStats()
    for i in range(1, len(data)):
        current = data[i]
        j = i - 1
        while j >= 0 and _less(stats, key, current, data[j]):
            data[j + 1] = data[j]
            stats.swaps += 1             # counted as a move
            j -= 1
        data[j + 1] = current
    return data, stats


def merge_sort(items, key):
    """DIVIDE AND CONQUER: split the list in half, sort each half, then merge the two sorted
    halves by repeatedly taking the smaller front item. O(n log n) always. Stable, because on a
    tie the LEFT item is taken first. Needs extra memory for the merged lists."""
    stats = SortStats()

    def sort(part):
        if len(part) <= 1:
            return part
        middle = len(part) // 2
        left, right = sort(part[:middle]), sort(part[middle:])
        merged, i, j = [], 0, 0
        while i < len(left) and j < len(right):
            if _less(stats, key, right[j], left[i]):     # only a STRICTLY smaller right item goes first
                merged.append(right[j])
                j += 1
            else:
                merged.append(left[i])
                i += 1
            stats.swaps += 1
        merged += left[i:] + right[j:]
        stats.swaps += len(left) - i + len(right) - j
        return merged
    return sort(list(items)), stats


def quick_sort(items, key):
    """Pick a pivot (the last item), move everything smaller to its left, then sort each side.
    O(n log n) on average, but O(n^2) if the pivot is always the smallest or biggest (a list
    that is already sorted). Sorts in place, no extra lists. NOT stable."""
    data, stats = list(items), SortStats()

    def sort(low, high):
        if low >= high:
            return
        pivot, boundary = data[high], low
        for i in range(low, high):
            if _less(stats, key, data[i], pivot):
                data[i], data[boundary] = data[boundary], data[i]
                stats.swaps += 1
                boundary += 1
        data[boundary], data[high] = data[high], data[boundary]
        stats.swaps += 1
        sort(low, boundary - 1)
        sort(boundary + 1, high)
    sort(0, len(data) - 1)
    return data, stats


# name -> (the sort, its speed, is it stable?)
SORTS = {
    "Bubble":    (bubble_sort,    "O(n\u00b2)",                     "yes"),
    "Selection": (selection_sort, "O(n\u00b2)",                     "no"),
    "Insertion": (insertion_sort, "O(n\u00b2), O(n) if nearly sorted", "yes"),
    "Merge":     (merge_sort,     "O(n log n)",                    "yes"),
    "Quick":     (quick_sort,     "O(n log n) avg, O(n\u00b2) worst", "no"),
}


class TriageBoard:
    """Ranks the infected plants and runs the Rescue. The sort key is a TUPLE, compared left to
    right: most valuable plant first, then the more grown plant, then the lower tile number.
    The last part means no two plants ever tie, so every sort gives the same final order."""

    def __init__(self, game, night):
        self.game = game
        self.night = night

    def threatened(self):
        """Every infected plant, as (tile, plant) - the plants Cleansing Spray can still save."""
        found = []
        for pos in sorted(self.night.blight):
            row, col = self.night.rc(pos)
            plant = self.game.grid.cells[row][col]
            if plant is not None and plant.infected:
                found.append((pos, plant))
        return found

    @staticmethod
    def priority(entry):
        pos, plant = entry
        return (-plant.sell_price, -STAGE_RANK[plant.stage], pos)

    def ranked(self, name=RESCUE_SORT):
        return SORTS[name][0](self.threatened(), self.priority)

    def publish(self):
        bridge = globals().get("updateTriage")
        if bridge is None:
            return
        entries = self.threatened()
        if not entries:
            bridge([], [], RESCUE_SORT)
            return
        ordered, _ = self.ranked()
        rows = [(pos, PLANT_DATA[plant.name]["emoji"], plant.name, plant.stage, plant.sell_price)
                for pos, plant in ordered]
        table = []
        for name, (sort_fn, speed, stable) in SORTS.items():
            _, stats = sort_fn(entries, self.priority)
            table.append((name, stats.comparisons, stats.swaps, speed, stable))
        bridge(rows, table, RESCUE_SORT)

    def rescue(self):
        """Sort the infected plants, then spend up to RESCUE_SPRAYS Sprays on the top of the list."""
        game, night = self.game, self.night
        entries = self.threatened()
        if not entries:
            return "There are no infected plants to rescue."
        if game.sprays_owned <= 0:
            return "You don't have any Cleansing Spray. Merchant Marco sells it."
        stamina_msg = game.spend_stamina("rescue")
        if stamina_msg:
            return stamina_msg
        ordered, stats = self.ranked()
        saved = []
        for pos, plant in ordered[:min(RESCUE_SPRAYS, game.sprays_owned)]:
            row, col = night.rc(pos)
            game.sprays_owned -= 1
            night.blight.discard(pos)
            plant.infected = False
            game.grid.redraw(row, col)
            saved.append(f"{plant.name} ({row}, {col})")
        stack.push_action(f"Rescue cured {len(saved)} plant(s)")
        game.refresh_shop()
        game.refresh_predator()
        self.publish()
        tired = game._tired_notice()
        return (f"Rescued {len(saved)} plant(s), most valuable first: {', '.join(saved)}. "
                f"{RESCUE_SORT} sort ranked {len(entries)} infected plant(s) in {stats.comparisons} comparisons."
                + (" " + tired if tired else ""))


if "triage_board" not in globals():
    triage_board = TriageBoard(game, night_defense)
triage_board.publish()

# ---- console demonstration (plain lists, so the game is untouched) ----
def _run_all(label, numbers):
    cells = []
    for name, (sort_fn, speed, stable) in SORTS.items():
        result, stats = sort_fn(numbers, lambda x: x)
        assert result == [x for x in sorted(numbers)]
        cells.append(f"{name} {stats.comparisons} comparisons / {stats.swaps} moves")
    print(f"{label} ({len(numbers)} items): " + "; ".join(cells) + ".\n")

print("TOPIC 8 - the same five sorts, counted on three lists of 12 numbers.\n\n")
_run_all("Shuffled", [7, 3, 11, 1, 9, 12, 4, 10, 2, 8, 6, 5])
_run_all("Nearly sorted", [1, 2, 3, 5, 4, 6, 7, 8, 9, 10, 12, 11])
_run_all("Reversed", list(range(12, 0, -1)))
print("Notice insertion sort on the nearly-sorted list: it only slides the two out-of-place items, "
      "so it beats even merge sort there. Notice quick sort on the reversed list: with the last item as "
      "pivot every split is lopsided, which is its O(n\u00b2) worst case.\n\n")
_ties = [("Apple", 1), ("Beet", 2), ("Corn", 2), ("Date", 1)]
_outcome = {name: [item[0] for item in SORTS[name][0](_ties, lambda item: item[1])[0]] for name in SORTS}
_original = _outcome["Merge"]          # Merge is stable, so it shows what "keeping the original order" looks like
_kept = [name for name in SORTS if _outcome[name] == _original]
_broke = [name for name in SORTS if _outcome[name] != _original]
print("STABILITY: sorting Apple(1), Beet(2), Corn(2), Date(1) by the number only, so Apple/Date and Beet/Corn tie. "
      + "; ".join(f"{name}: {' '.join(order)}" for name, order in _outcome.items())
      + f". {', '.join(_kept)} keep each pair in its original order (stable); {', '.join(_broke)} swap items over long "
      "distances and reorder equal items (unstable). That is why the Triage Board's key ends with the tile number: "
      "with no ties, stability stops mattering and every sort gives the same rescue order.\n\n")

# ===== TOPIC 9 =====
# Topic 9: Searching Algorithms (Linear Search vs. Binary Search)
#
# THE NIGHT DEFENSE SYSTEM, part 4: the Blight Radar.
# The radar scans one tile and asks: "how many blighted tiles are within 1 step? 2 steps? ... 9?"
# It answers each question twice, with a LINEAR search and a BINARY search, and shows how many
# steps each one took. Binary search is much faster - but only on a SORTED list.

RADAR_RINGS = 9                 # the scan answers for 1 to this many steps away


def linear_search(items, target):
    """Look at every item in turn until one matches. Works on ANY list. O(n).
    Returns (index or -1, steps taken)."""
    steps = 0
    for index, item in enumerate(items):
        steps += 1
        if item == target:
            return index, steps
    return -1, steps


def binary_search(items, target):
    """Needs a SORTED list. Look at the middle item: if it is the target we are done; if the
    target is smaller, throw away the right half; if bigger, throw away the left half. Each
    step halves what is left, so 1,000 items need at most 10 steps. O(log n).
    Returns (index or -1, steps taken)."""
    low, high, steps = 0, len(items) - 1, 0
    while low <= high:
        middle = (low + high) // 2
        steps += 1
        if items[middle] == target:
            return middle, steps
        if items[middle] < target:
            low = middle + 1
        else:
            high = middle - 1
    return -1, steps


def linear_count_within(distances, limit):
    """How many distances are <= limit? With no order to rely on, every item must be checked."""
    steps = count = 0
    for distance in distances:
        steps += 1
        if distance <= limit:
            count += 1
    return count, steps


def binary_count_within(distances, limit):
    """The same question on a SORTED list: binary search for the first distance that is > limit.
    Everything before it is <= limit, so its index IS the answer. O(log n)."""
    low, high, steps = 0, len(distances), 0
    while low < high:
        middle = (low + high) // 2
        steps += 1
        if distances[middle] <= limit:
            low = middle + 1
        else:
            high = middle
    return low, steps


class BlightRadar:
    """Scans one tile. The distances come from Topic 7's BFS, run from the scanned tile with
    barrier Wards as walls (blight cannot cross those). BFS discovers tiles nearest-first, so the
    list of blight distances arrives ALREADY SORTED, which is exactly what binary search needs.
    (If that were ever not true, Topic 8's merge sort puts it in order first.)"""

    def __init__(self, game, night):
        self.game = game
        self.night = night

    def distances_from(self, pos):
        reach = self.night.graph.bfs([pos], blocked=lambda tile: tile in self.night.barrier)
        found = [steps for tile, steps in reach.items() if tile in self.night.blight]
        if any(found[i] > found[i + 1] for i in range(len(found) - 1)):
            found = merge_sort(found, lambda x: x)[0]
        return found

    def scan(self, row, col):
        game, night = self.game, self.night
        if not game.radar_unlocked:
            return "You need the Blight Radar. Merchant Marco sells it."
        if not game.grid.in_bounds(row, col):
            return "That tile is outside the garden."
        stamina_msg = game.spend_stamina("radar")
        if stamina_msg:
            return stamina_msg
        pos = night.pos(row, col)
        distances = self.distances_from(pos)
        total_blight = len(night.blight)

        rings, binary_steps, linear_steps = [], 0, 0
        for limit in range(1, RADAR_RINGS + 1):
            count, b_steps = binary_count_within(distances, limit)
            check, l_steps = linear_count_within(distances, limit)
            assert count == check
            rings.append(count)
            binary_steps += b_steps
            linear_steps += l_steps

        where = f"row {row + 1}, column {col + 1}"
        if total_blight == 0:
            summary = "No blight anywhere in the garden."
        elif not distances:
            summary = "Every blighted tile is cut off from here by a barrier. This tile is protected."
        elif distances[0] == 0:
            summary = "This tile is already blighted."
        else:
            nights = distances[0]
            summary = (f"The nearest blight is {nights} step{'s' if nights != 1 else ''} away: "
                       f"it reaches this tile in about {nights} night{'s' if nights != 1 else ''} if it keeps spreading.")
        note = "BFS finds tiles nearest-first, so the distances arrived already sorted and binary search could start at once."
        if len(distances) <= 2:
            note += " With only a couple of distances the two searches cost about the same; binary search pays off as the list grows."
        stack.push_action(f"Radar scan at ({row}, {col})")
        self.publish(where, summary, rings, binary_steps, linear_steps, len(distances), note)
        return summary

    def publish(self, where, summary, rings, binary_steps, linear_steps, count, note):
        bridge = globals().get("updateRadar")
        if bridge is not None:
            bridge(where, summary, rings, binary_steps, linear_steps, count, note)

    def clear(self):
        self.publish("", "", [], 0, 0, 0, "")


if "blight_radar" not in globals():
    blight_radar = BlightRadar(game, night_defense)

# ---- console demonstration (plain lists, so the game is untouched) ----
print("TOPIC 9 - linear vs binary search: the most steps each needs to find one item in a sorted list.\n\n")
_rows = []
for _n in (10, 100, 1000, 10000):
    _data = list(range(_n))
    _worst_binary = max(binary_search(_data, target)[1] for target in range(-1, _n + 1))
    _rows.append(f"{_n:,} items: linear {linear_search(_data, _n - 1)[1]:,} steps, binary at most {_worst_binary}")
print("; ".join(_rows) + ". Doubling the list adds ONE step to binary search - that is O(log n).\n\n")
_jumbled = [9, 2, 7, 4, 1, 8, 3]
_ordered = merge_sort(_jumbled, lambda x: x)[0]
print(f"BINARY SEARCH NEEDS SORTED DATA: looking for 1 in {_jumbled}, linear search finds it (index {linear_search(_jumbled, 1)[0]}) "
      f"but binary search returns {binary_search(_jumbled, 1)[0]} (not found) because it threw away the wrong half. "
      f"Sort first ({_ordered}) and it works: index {binary_search(_ordered, 1)[0]}.\n\n")
_random_list = [(i * 7919) % 1009 for i in range(1000)]
_sort_cost = merge_sort(_random_list, lambda x: x)[1].comparisons
_sorted_list = merge_sort(_random_list, lambda x: x)[0]
_binary_each = max(binary_search(_sorted_list, value)[1] for value in _sorted_list[:200])
_break_even = -(-_sort_cost // (len(_random_list) - _binary_each))
print(f"IS SORTING WORTH IT? On 1,000 unsorted items, sorting once costs about {_sort_cost:,} comparisons. After that each lookup costs about {_binary_each} steps, "
      f"against 1,000 for a linear scan. So binary search only wins once you ask about {_break_even} or more questions of the same list - "
      "for a single question, just scan. The radar gets its sorted list for free from BFS, so it asks 9 questions at no sorting cost.\n\n")



# ===== TOPIC 10 =====
# Topic 10: Advanced Strategic Paradigms (Dijkstra's Algorithm & Greedy Patterns)
#
# THE NIGHT DEFENSE SYSTEM, part 2: the Roaming Predator and Quick-Defend.
# The Shadow Hound uses DIJKSTRA'S ALGORITHM to find the cheapest route through the garden to
# your most valuable plant. Quick-Defend is a GREEDY algorithm that spends your spare Wards on
# the tiles that hurt that route the most, one best-looking choice at a time.
import heapq

# ---- tuning knobs (Lead Architect: change these to rebalance the hound) ----
FIRST_PREDATOR_NIGHT = 8       # the first hound appears when this day ends...
PREDATOR_EVERY = 3             # ...and another every this-many nights (only one at a time)
PREDATOR_STEPS = 5             # tiles it walks along its route each night
LINGER_NIGHTS = 2              # nights it waits around when nothing is reachable
QUICK_DEFEND_WARDS = 3         # most Wards one Quick-Defend will place
COST_BARE, COST_PLANT, COST_LONE_WARD = 1, 3, 8     # what it costs the hound to ENTER a tile
INFINITY = float("inf")        # a cost for "can't get there"


def make_cost_function(graph, blight, wards, has_plant):
    """Builds cost(tile): what entering that tile costs the hound, or None if it can't.
    Blight and barrier Wards (3+ linked, found by Topic 7's DFS) are impassable. A lone Ward
    is crossable but expensive: the hound smashes it. A plant is mildly costly, bare ground cheap."""
    groups = graph.dfs_groups(wards)
    barrier = {pos for group in groups if len(group) >= BARRIER_SIZE for pos in group}

    def cost(pos):
        if pos in blight or pos in barrier:
            return None
        if pos in wards:
            return COST_LONE_WARD
        return COST_PLANT if has_plant(pos) else COST_BARE
    return cost


def dijkstra(graph, source, cost_of):
    """DIJKSTRA'S ALGORITHM: the cheapest route from `source` to every tile it can reach.
    BFS (Topic 7) counts STEPS, so it is only right when every step costs the same. Here a Ward
    costs far more than bare ground, so we keep a PRIORITY QUEUE (a min-heap) of tiles ordered
    by the cost to reach them, and always expand the cheapest one next. The first time a tile is
    taken off the queue, no cheaper route to it can exist.
    Returns ({tile: cheapest cost}, {tile: the tile we came from}). O((V + E) log V)."""
    best = {source: 0}
    came_from = {}
    queue = [(0, source)]                      # heapq keeps the smallest (cost, tile) on top
    while queue:
        spent, pos = heapq.heappop(queue)      # O(log n)
        if spent > best.get(pos, INFINITY):
            continue                           # a cheaper way here was found after this entry was queued
        for neighbour in graph.adj[pos]:
            step = cost_of(neighbour)
            if step is None:
                continue
            total = spent + step
            if total < best.get(neighbour, INFINITY):
                best[neighbour] = total
                came_from[neighbour] = pos
                heapq.heappush(queue, (total, neighbour))   # O(log n)
    return best, came_from


def route_between(came_from, source, target):
    """Walk the came_from links back from the target, then flip: [source, ..., target]."""
    route = [target]
    while route[-1] != source:
        route.append(came_from[route[-1]])
    return route[::-1]


class PredatorPlan:
    def __init__(self, target, route, cost):
        self.target, self.route, self.cost = target, route, cost


class PredatorSystem:
    """The Shadow Hound. It appears on an edge tile, then each night walks up to
    PREDATOR_STEPS tiles of the cheapest route to the most valuable plant it can reach, eats
    it on arrival and leaves. Every night it plans again, so Wards you place change its mind."""
    NAME = "Shadow Hound"

    def __init__(self, game, night):
        self.game = game
        self.night = night
        self.pos = None          # None = no predator in the garden
        self.idle = 0            # nights spent with nothing reachable

    def present(self):
        return self.pos is not None

    # ---- planning (Dijkstra) ----
    def has_plant(self, pos):
        row, col = self.night.rc(pos)
        return self.game.grid.cells[row][col] is not None

    def cost_function(self, wards=None):
        return make_cost_function(self.night.graph, self.night.blight,
                                  self.night.wards if wards is None else wards, self.has_plant)

    def make_plan(self, wards=None):
        """Dijkstra from the hound, then pick the target: the priciest healthy plant it can reach
        (ties go to the cheaper route). Returns a PredatorPlan, or None if nothing is reachable."""
        best, came_from = dijkstra(self.night.graph, self.pos, self.cost_function(wards))
        pick = None
        for pos, cost in best.items():
            row, col = self.night.rc(pos)
            plant = self.game.grid.cells[row][col]
            if pos == self.pos or plant is None or plant.infected:
                continue
            key = (-plant.sell_price, cost, pos)
            if pick is None or key < pick[0]:
                pick = (key, pos)
        if pick is None:
            return None
        target = pick[1]
        return PredatorPlan(target, route_between(came_from, self.pos, target), best[target])

    def cost_to(self, target, wards):
        """The hound's cheapest cost to one tile if the Wards were `wards` (INFINITY if sealed off)."""
        best, _ = dijkstra(self.night.graph, self.pos, self.cost_function(wards))
        return best.get(target, INFINITY)

    # ---- the night ----
    def run_night(self, day):
        if self.present():
            return self.advance()
        if day >= FIRST_PREDATOR_NIGHT and (day - FIRST_PREDATOR_NIGHT) % PREDATOR_EVERY == 0:
            return self.spawn()
        return ""

    def spawn(self):
        free = [pos for pos in self.night.edge_tiles()
                if pos not in self.night.blight and pos not in self.night.wards]
        bare = [pos for pos in free if not self.has_plant(pos)]
        pool = bare or free
        if not pool:
            return ""
        self.pos = random.choice(pool)
        self.idle = 0
        return f"A {self.NAME} has appeared at the edge of the garden! It is hunting your most valuable plant."

    def advance(self):
        game, night = self.game, self.night
        plan = self.make_plan()
        if plan is None:
            self.idle += 1
            if self.idle >= LINGER_NIGHTS:
                self.pos = None
                return f"The {self.NAME} could not reach anything and left."
            return f"The {self.NAME} prowls the garden, but every plant is out of its reach."
        self.idle = 0
        smashed = 0
        for pos in plan.route[1:PREDATOR_STEPS + 1]:
            if pos in night.wards:             # a lone Ward in the way: it smashes through
                night.wards.discard(pos)
                smashed += 1
            self.pos = pos
        if smashed:
            night.recompute_barrier()
            night.redraw(night.wards | {self.pos})
        message = ""
        if self.pos == plan.target:
            row, col = night.rc(self.pos)
            plant = game.grid.remove(row, col)
            stack.push_action(f"The {self.NAME} ate the {plant.name} at ({row}, {col})")
            message = f"The {self.NAME} reached your {plant.name} and ate it, then left."
            self.pos = None
        else:
            message = f"The {self.NAME} is closing in on your garden."
        if smashed:
            message += f" It smashed {smashed} Ward(s) on the way."
        return message

    # ---- Quick-Defend: a GREEDY algorithm ----
    def quick_defend(self):
        """Spend up to QUICK_DEFEND_WARDS Wards. Each one goes on the single tile of the hound's
        route that makes its trip to the target cost the MOST (an unreachable target is the
        biggest cost of all). Then re-plan and repeat. That is greedy: always the best choice
        right now, never looking ahead to how Wards work together. Fast, but not always best."""
        game, night = self.game, self.night
        if not self.present():
            return f"No predator is hunting right now."
        if game.wards_owned <= 0:
            return "You don't have any Wards. Merchant Marco sells them."
        plan = self.make_plan()
        if plan is None:
            return f"The {self.NAME} can't reach any plant, so there is nothing to defend."
        stamina_msg = game.spend_stamina("defend")
        if stamina_msg:
            return stamina_msg
        before = plan.cost
        placed = []
        for _ in range(min(QUICK_DEFEND_WARDS, game.wards_owned)):
            plan = self.make_plan()
            if plan is None:
                break
            bare_on_route = [pos for pos in plan.route[1:-1]
                             if pos not in night.wards and pos not in night.blight and not self.has_plant(pos)]
            if not bare_on_route:
                break
            choice, choice_cost = None, -1
            for pos in bare_on_route:          # try each candidate, keep the one with the biggest cost
                cost = self.cost_to(plan.target, night.wards | {pos})
                if cost > choice_cost:         # strictly greater: ties keep the tile nearest the hound
                    choice, choice_cost = pos, cost
            game.wards_owned -= 1
            night.wards.add(choice)
            night.recompute_barrier()
            placed.append(choice)
        night.redraw(night.wards)
        if not placed:
            return "There is no bare ground on the hound's route to defend."
        after = self.make_plan()
        stack.push_action(f"Quick-Defend placed {len(placed)} Ward(s)")
        game.refresh_shop()
        game.refresh_predator()
        spots = ", ".join(f"({night.rc(pos)[0]}, {night.rc(pos)[1]})" for pos in placed)
        result = (f"its route now costs {after.cost}" if after is not None
                  else f"it cannot reach any plant")
        tired = game._tired_notice()
        return (f"Quick-Defend placed {len(placed)} Ward(s) at {spots}: it cost the {self.NAME} "
                f"{before} to reach its target; {result}." + (" " + tired if tired else ""))

    # ---- what the page shows ----
    def publish(self):
        bridge = globals().get("updatePredator")
        if bridge is None:
            return
        if not self.present():
            bridge(False, False, -1, [], "", 0)
            return
        revealed = self.game.lens_active
        plan = self.make_plan() if revealed else None
        if plan is None:
            bridge(True, revealed, self.pos if revealed else -1, [], "", 0)
            return
        row, col = self.night.rc(plan.target)
        steps = len(plan.route) - 1
        nights = -(-steps // PREDATOR_STEPS)           # ceiling division
        bridge(True, True, self.pos, plan.route, self.game.grid.cells[row][col].name, nights)


if "predator_system" not in globals():
    predator_system = PredatorSystem(game, night_defense)

# ---- console demonstration (scratch maps only; the game is untouched) ----
_g = GardenGraph(10, 10)

def _steps_route(source, target):
    """The BFS route: fewest steps, ignoring what tiles cost."""
    steps = _g.bfs([source])
    route = [target]
    while route[-1] != source:
        route.append(next(n for n in _g.adj[route[-1]] if steps[n] == steps[route[-1]] - 1))
    return route[::-1]

_cost = make_cost_function(_g, set(), {4}, lambda pos: False)       # one lone Ward on tile 4, in the way
_dist, _from = dijkstra(_g, 0, _cost)
_cheap = route_between(_from, 0, 9)
_fewest = _steps_route(0, 9)
def _total(route):
    return sum(_cost(pos) for pos in route[1:])
print("TOPIC 10 - Dijkstra vs BFS. A lone Ward (cost 8) sits on tile 4, between the hound at tile 0 and a plant at tile 9.\n\n")
print(f"BFS only counts steps: it takes the straight line, {len(_fewest) - 1} steps, but that smashes the Ward and costs {_total(_fewest)}. "
      f"Dijkstra weighs the costs: it detours, {len(_cheap) - 1} steps, for a total cost of only {_total(_cheap)}. "
      "Fewest steps is not the same as cheapest route - which is why the hound needs Dijkstra.\n\n")
print("Dijkstra keeps a priority queue (heapq, a binary min-heap): each push and pop is O(log n), "
      "so the whole search is O((V + E) log V) - about 100 tiles and 180 edges here.\n\n")

# GREEDY vs BEST: a 5 x 5 scratch map. Blight (impassable) on 6, 7 and 23; the hound starts at tile 0, the plant is tile 24.
_small = GardenGraph(5, 5)
_blight = {6, 7, 23}
def _small_cost(wards):
    return make_cost_function(_small, _blight, wards, lambda pos: False)
def _small_reach(wards):
    return dijkstra(_small, 0, _small_cost(wards))[0].get(24, INFINITY)
_free = [pos for pos in range(25) if pos not in _blight and pos not in (0, 24)]
_wards = set()
for _ in range(3):                                   # the greedy rule, 3 Wards, one at a time
    _wards.add(max(_free, key=lambda pos: (_small_reach(_wards | {pos}) if pos not in _wards else -1, -pos)))
_greedy_cost = _small_reach(_wards)
_best_cost, _best_set = -1, None
for _combo in __import__("itertools").combinations(_free, 3):   # brute force: try every triple (1,140 of them)
    _c = _small_reach(set(_combo))
    if _c > _best_cost:
        _best_cost, _best_set = _c, _combo
_say = lambda c: "sealed off completely" if c == INFINITY else f"a route costing {c}"
print("GREEDY vs BEST on a small scratch map (3 Wards to place): "
      f"greedy picks {sorted(_wards)} and leaves the hound {_say(_greedy_cost)}; "
      f"trying all 1,140 triples finds {sorted(_best_set)}, which leaves it {_say(_best_cost)}. "
      "Greedy never saw that three Wards placed together make a barrier, because each single Ward looked weak on its own. "
      "That is the trade-off: greedy is fast (a few Dijkstra runs) but not guaranteed best; brute force is best but needs 1,140 runs.\n\n")



# ===== TOPIC 11 =====
# Topic 11: Dynamic Programming (DP), Memoization, & Divide-and-Conquer
#
# THE NIGHT DEFENSE SYSTEM, part 5: the Magpie Thief.
# On some nights a magpie raids your Inventory, the plants you have harvested but not sold. It
# can only carry so much, and every plant has a SIZE and a VALUE, so deciding what to steal is the
# 0/1 KNAPSACK problem. The magpie solves it with DYNAMIC PROGRAMMING: solve each small
# sub-question once, write the answer in a table, and build the big answer from the table.
# The same answer can be found top-down with MEMOIZATION (plain recursion plus a notebook).
# (Divide and conquer, splitting a problem into independent halves, is merge sort in Topic 8.)

FIRST_RAID_NIGHT = 6           # the first raid happens when this day ends...
RAID_EVERY = 4                 # ...and another every this-many nights
BASE_CAPACITY = 10             # how much the magpie can carry on its first raid
CAPACITY_PER_RAID = 2          # it gets stronger after every raid
MAX_CAPACITY = 30
MAX_CONSIDERED = 40            # it only looks over the 40 most valuable plants


def knapsack_bottom_up(items, capacity):
    """BOTTOM-UP DP. items = [(size, value), ...]. table[i][w] = the best value using only the
    first i items with room for w. Each cell is built from two earlier cells: skip item i, or
    take it and spend its size. Fill the whole table once, then walk back to see which items
    were taken. O(items x capacity) time and space.
    Returns (best value, indexes of the items taken, number of table cells computed)."""
    n = len(items)
    table = [[0] * (capacity + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        size, value = items[i - 1]
        for room in range(capacity + 1):
            table[i][room] = table[i - 1][room]                              # skip item i
            if size <= room and table[i - 1][room - size] + value > table[i][room]:
                table[i][room] = table[i - 1][room - size] + value           # take item i
    taken, room = [], capacity
    for i in range(n, 0, -1):
        if table[i][room] != table[i - 1][room]:                             # the answer changed here, so item i was taken
            taken.append(i - 1)
            room -= items[i - 1][0]
    return table[n][capacity], sorted(taken), n * (capacity + 1)


def knapsack_top_down(items, capacity):
    """TOP-DOWN with MEMOIZATION: ask "what is the best value for the first i items with room w?"
    recursively, but write each answer in a notebook (memo) the first time it is worked out. The
    same (i, w) question comes up again and again, and the notebook turns those repeats into
    instant look-ups. Returns (best value, number of distinct sub-questions solved)."""
    memo = {}

    def best(i, room):
        if i == 0:
            return 0
        if (i, room) in memo:
            return memo[(i, room)]
        size, value = items[i - 1]
        answer = best(i - 1, room)
        if size <= room:
            answer = max(answer, best(i - 1, room - size) + value)
        memo[(i, room)] = answer
        return answer
    return best(len(items), capacity), len(memo)


def knapsack_naive_calls(items, capacity):
    """The same recursion with NO notebook, only to count how many calls it makes (it doubles with every item)."""
    calls = 0

    def best(i, room):
        nonlocal calls
        calls += 1
        if i == 0:
            return 0
        size, value = items[i - 1]
        answer = best(i - 1, room)
        if size <= room:
            answer = max(answer, best(i - 1, room - size) + value)
        return answer
    return best(len(items), capacity), calls


class MagpieThief:
    """The raiding magpie. Decides what to steal with the knapsack DP, takes it from the Inventory
    at night, and (with a Scout's Lens) shows tonight's forecast. A plant's SIZE is its growth
    days (a long-growing plant is bulky); its VALUE is today's sell price, mutation included."""
    NAME = "Magpie"

    def __init__(self, game):
        self.game = game
        self.raids = 0                       # raids so far: the magpie carries more each time

    def raid_due(self, day):
        """Does the night that ends `day` bring a raid?"""
        return day >= FIRST_RAID_NIGHT and (day - FIRST_RAID_NIGHT) % RAID_EVERY == 0

    def capacity(self):
        return min(MAX_CAPACITY, BASE_CAPACITY + CAPACITY_PER_RAID * self.raids)

    def protected_key(self):
        """With the Lockbox, the stack worth the most in total can never be taken."""
        if not self.game.lockbox_unlocked or not self.game.inventory.items:
            return None
        price = self.game.sell_price_for
        return max(sorted(self.game.inventory.items), key=lambda key: price(key) * self.game.inventory.items[key])

    def candidates(self):
        """Every single plant the magpie could grab, as (stack key, size, value): the 40 most valuable."""
        game, safe = self.game, self.protected_key()
        units = []
        for key, qty in sorted(game.inventory.items.items()):
            if key == safe:
                continue
            size = PLANT_DATA[split_key(key)[0]]["grow_days"]
            units += [(key, size, game.sell_price_for(key))] * qty
        units.sort(key=lambda unit: (-unit[2], unit[0]))     # most valuable first (ties by name)
        return units[:MAX_CONSIDERED]

    def plan(self):
        """What the magpie would take right now: ({stack key: count}, total value, total size, table cells, memo size)."""
        units = self.candidates()
        capacity = self.capacity()
        items = [(size, value) for _, size, value in units]
        value, taken, cells = knapsack_bottom_up(items, capacity)
        check, memo_size = knapsack_top_down(items, capacity)
        assert check == value                 # both ways of doing DP must agree
        loot = {}
        for index in taken:
            loot[units[index][0]] = loot.get(units[index][0], 0) + 1
        return loot, value, sum(items[i][0] for i in taken), cells, memo_size

    def run_night(self, day):
        if not self.raid_due(day):
            return ""
        game = self.game
        loot, value, size, _, _ = self.plan()
        self.raids += 1
        safe = self.protected_key()
        if not loot:
            return f"A {self.NAME} circled your Inventory but found nothing it could carry off."
        for key, count in loot.items():
            game.inventory.take(key, count)
        game.refresh_inventory()
        names = ", ".join(f"{count}x {stack_label(key)}" for key, count in sorted(loot.items()))
        text = f"A {self.NAME} raided your Inventory and flew off with {names} (worth {value:,} coins)."
        if safe is not None:
            text += f" Your Lockbox kept the {stack_label(safe)} safe."
        return text

    def publish(self):
        """The forecast panel: only while a Scout's Lens is active and a raid is due tonight."""
        bridge = globals().get("updateRaid")
        if bridge is None:
            return
        game = self.game
        if not (game.lens_active and self.raid_due(game.day)):
            bridge(False, [], 0, 0, 0, 0, 0, "")
            return
        loot, value, size, cells, memo_size = self.plan()
        rows = []
        for key, count in sorted(loot.items(), key=lambda pair: -game.sell_price_for(pair[0]) * pair[1]):
            name, mutation = split_key(key)
            rows.append((key, PLANT_DATA[name]["emoji"], name, mutation or "", count))
        safe = self.protected_key()
        bridge(True, rows, value, size, self.capacity(), cells, memo_size, stack_label(safe) if safe else "")


if "magpie_thief" not in globals():
    magpie_thief = MagpieThief(game)

# ---- console demonstration (plain numbers, so the game is untouched) ----
def _fib_naive(n, counter):
    counter[0] += 1
    return n if n < 2 else _fib_naive(n - 1, counter) + _fib_naive(n - 2, counter)

def _fib_memo(n, memo, counter):
    counter[0] += 1
    if n in memo:
        return memo[n]
    memo[n] = n if n < 2 else _fib_memo(n - 1, memo, counter) + _fib_memo(n - 2, memo, counter)
    return memo[n]

_naive_count, _memo_count = [0], [0]
_fib_naive(25, _naive_count)
_fib_memo(25, {}, _memo_count)
print(f"TOPIC 11 - the idea in one picture: computing fib(25) by plain recursion makes {_naive_count[0]:,} calls, because it re-solves "
      f"the same small cases again and again. Write each answer in a notebook the first time (memoization) and it makes {_memo_count[0]} calls.\n\n")

_sample = [(3, 40), (4, 50), (5, 70), (6, 60), (2, 25), (7, 90), (3, 35), (4, 45), (5, 55), (6, 80), (2, 20), (4, 65), (3, 30), (5, 75)]
_best, _taken, _cells = knapsack_bottom_up(_sample, 15)
_top, _memo = knapsack_top_down(_sample, 15)
_, _naive_calls = knapsack_naive_calls(_sample, 15)
print(f"KNAPSACK on 14 items with room for 15: the best haul is worth {_best}. Bottom-up fills a table of {_cells} cells; "
      f"top-down with a notebook solves {_memo} distinct sub-questions and agrees ({_top}); the same recursion with no notebook makes "
      f"{_naive_calls:,} calls. With 40 items it could reach about a trillion, which is why the magpie needs DP.\n\n")

_greedy_pick, _room, _greedy_value = [], 15, 0
for _size, _value in sorted(_sample, key=lambda item: -item[1] / item[0]):      # best value per size first
    if _size <= _room:
        _greedy_pick.append((_size, _value))
        _room -= _size
        _greedy_value += _value
print(f"GREEDY vs DP: grabbing the best value-per-size first only reaches {_greedy_value}, against DP's {_best}. "
      "Greedy never reconsiders; DP weighs every combination without trying them all.\n\n")
