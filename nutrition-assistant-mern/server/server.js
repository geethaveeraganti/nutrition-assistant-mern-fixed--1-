import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  profile: {
    age: { type: Number, min: 18, max: 120, default: null},
    sex: { type: String, enum: ["female", "male", "other"], default: null },
    heightCm: { type: Number, min: 100, max: 250, default: null },
    weightKg: { type: Number, min: 25, max: 350, default: null },
    activity: { type: String, enum: ["low", "light", "moderate", "high"], default: null },
    goal: { type: String, enum: ["maintain", "lose", "gain"], default: null },
    diet: { type: String, enum: ["any", "vegetarian", "vegan"], default: null }
  }
}, { timestamps: true });
const User = mongoose.model("User", userSchema);

const logSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  food: { type: String, required: true, trim: true, maxlength: 100 },
  meal: { type: String, enum: ["Breakfast", "Lunch", "Dinner", "Snack"], default: "Snack" },
  calories: { type: Number, min: 0, max: 10000, required: true },
  protein: { type: Number, min: 0, max: 1000, default: 0 },
  carbs: { type: Number, min: 0, max: 1000, default: 0 },
  fat: { type: Number, min: 0, max: 1000, default: 0 },
  day: { type: String, required: true }
}, { timestamps: true });
const FoodLog = mongoose.model("FoodLog", logSchema);

function tokenFor(user) {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
}
function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, profile: user.profile };
}
function auth(req, res, next) {
  const value = req.headers.authorization || "";
  const token = value.startsWith("Bearer ") ? value.slice(7) : "";
  try {
    if (!token) throw new Error("Missing token");
    req.userId = jwt.verify(token, process.env.JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ message: "Please log in again." });
  }
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8)
      return res.status(400).json({ message: "Enter a name, valid email, and password of at least 8 characters." });
    if (await User.findOne({ email })) return res.status(409).json({ message: "That email is already registered." });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (e) { res.status(500).json({ message: "Could not register. Please try again." }); }
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.passwordHash)))
    return res.status(401).json({ message: "Email or password is incorrect." });
  res.json({ token: tokenFor(user), user: publicUser(user) });
});

app.get("/api/profile", auth, async (req, res) => {
  const user = await User.findById(req.userId).select("-passwordHash");
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json(publicUser(user));
});

app.put("/api/profile", auth, async (req, res) => {
  const allowed = ["age", "sex", "heightCm", "weightKg", "activity", "goal", "diet"];
  const profile = {};
  for (const key of allowed) if (req.body[key] !== undefined) profile[key] = req.body[key];
  try {
    const user = await User.findByIdAndUpdate(req.userId, { $set: Object.fromEntries(Object.entries(profile).map(([k,v]) => [`profile.${k}`, v])) }, { new: true, runValidators: true }).select("-passwordHash");
    res.json(publicUser(user));
  } catch { res.status(400).json({ message: "Profile values are invalid. Check the fields and try again." }); }
});

const foods = [
  { name: "Oats with milk", meal: "Breakfast", diet: ["any", "vegetarian"], calories: 300, protein: 14, carbs: 45, fat: 8, tags: ["balanced", "fiber"] },
  { name: "Idli with sambar", meal: "Breakfast", diet: ["any", "vegetarian", "vegan"], calories: 320, protein: 12, carbs: 58, fat: 5, tags: ["balanced"] },
  { name: "Tofu scramble with toast", meal: "Breakfast", diet: ["vegan", "vegetarian"], calories: 330, protein: 20, carbs: 32, fat: 12, tags: ["protein"] },
  { name: "Greek yogurt with fruit", meal: "Snack", diet: ["any", "vegetarian"], calories: 180, protein: 15, carbs: 24, fat: 3, tags: ["protein"] },
  { name: "Apple with peanut butter", meal: "Snack", diet: ["any", "vegetarian", "vegan"], calories: 210, protein: 5, carbs: 28, fat: 11, tags: ["fiber"] },
  { name: "Chickpea salad with roti", meal: "Lunch", diet: ["any", "vegetarian", "vegan"], calories: 460, protein: 18, carbs: 68, fat: 12, tags: ["fiber", "balanced"] },
  { name: "Dal, rice and vegetables", meal: "Lunch", diet: ["any", "vegetarian", "vegan"], calories: 520, protein: 19, carbs: 86, fat: 10, tags: ["balanced"] },
  { name: "Grilled chicken, rice and vegetables", meal: "Lunch", diet: ["any"], calories: 550, protein: 42, carbs: 62, fat: 12, tags: ["protein"] },
  { name: "Paneer with vegetables and roti", meal: "Dinner", diet: ["any", "vegetarian"], calories: 500, protein: 25, carbs: 52, fat: 20, tags: ["protein"] },
  { name: "Tofu, brown rice and vegetables", meal: "Dinner", diet: ["vegan", "vegetarian"], calories: 480, protein: 24, carbs: 65, fat: 13, tags: ["protein", "balanced"] },
  { name: "Fish with potato and greens", meal: "Dinner", diet: ["any"], calories: 510, protein: 38, carbs: 45, fat: 17, tags: ["protein"] },
  { name: "Roasted chickpeas", meal: "Snack", diet: ["any", "vegetarian", "vegan"], calories: 160, protein: 8, carbs: 25, fat: 4, tags: ["fiber"] }
];

function nutritionTargets(p) {
  const bmi = p.weightKg / ((p.heightCm / 100) ** 2);
  // Mifflin-St Jeor is an estimate; 'other' uses a midpoint rather than a sex-specific assumption.
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : p.sex === "female" ? -161 : -78);
  const factor = { low: 1.2, light: 1.375, moderate: 1.55, high: 1.725 }[p.activity] || 1.55;
  const maintenance = Math.round(base * factor);
  const calories = Math.round(Math.max(1200, maintenance + ({ lose: -300, gain: 250, maintain: 0 }[p.goal] || 0)));
  return { bmi: Number(bmi.toFixed(1)), maintenanceCalories: maintenance, dailyCalories: calories, proteinGrams: Math.round((calories * 0.20) / 4), carbsGrams: Math.round((calories * 0.50) / 4), fatGrams: Math.round((calories * 0.30) / 9) };
}
const PROFILE_DEFAULTS = { age: 25, sex: "other", heightCm: 165, weightKg: 65, activity: "moderate", goal: "maintain", diet: "any" };
const DIETS = ["any", "vegetarian", "vegan"];
function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
app.get("/api/recommendations", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    // Fill any missing/invalid profile fields with defaults so old accounts still get meal ideas.
    const stored = user.toObject().profile || {};
    const p = { ...PROFILE_DEFAULTS };
    for (const key of Object.keys(PROFILE_DEFAULTS)) if (stored[key] !== undefined && stored[key] !== null && stored[key] !== "") p[key] = stored[key];
    if (!DIETS.includes(p.diet)) p.diet = "any";
    const targets = nutritionTargets(p);
    let available = foods.filter(f => f.diet.includes(p.diet));
    // Lightweight transparent preference ranking, not a trained AI model.
    if (p.goal === "gain") available.sort((a,b) => (b.protein + b.calories / 100) - (a.protein + a.calories / 100));
    if (p.goal === "lose") available.sort((a,b) => (a.calories / Math.max(a.protein, 1)) - (b.calories / Math.max(b.protein, 1)));
    // ?shuffle=1 (the "Generate new ideas" button) mixes the options so you can see different ones.
    if (req.query.shuffle === "1") available = shuffled(available);
    const meals = ["Breakfast", "Lunch", "Dinner", "Snack"].map(meal => ({
      meal, items: available.filter(f => f.meal === meal).slice(0, 3)
    }));
    res.json({ targets, meals, note: "Estimates are educational and may not fit individual medical needs. Food nutrition values are approximate." });
  } catch (e) {
    console.error("Recommendations error:", e);
    res.status(500).json({ message: "Could not generate meal ideas. Please try again." });
  }
});

function todayLocalUTCString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
app.get("/api/logs", auth, async (req, res) => {
  const day = String(req.query.day || todayLocalUTCString());
  const logs = await FoodLog.find({ userId: req.userId, day }).sort({ createdAt: -1 }).limit(100);
  const totals = logs.reduce((a, f) => ({ calories: a.calories + f.calories, protein: a.protein + f.protein, carbs: a.carbs + f.carbs, fat: a.fat + f.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  res.json({ logs, totals, day });
});
app.post("/api/logs", auth, async (req, res) => {
  const { food, meal, calories, protein = 0, carbs = 0, fat = 0 } = req.body;
  if (!String(food || "").trim() || !Number.isFinite(Number(calories)) || Number(calories) < 0)
    return res.status(400).json({ message: "Food name and a valid calorie amount are required." });
  try {
    const log = await FoodLog.create({ userId: req.userId, food: String(food).trim(), meal, calories: Number(calories), protein: Number(protein), carbs: Number(carbs), fat: Number(fat), day: todayLocalUTCString() });
    res.status(201).json(log);
  } catch { res.status(400).json({ message: "Could not save food log. Check your values." }); }
});
app.delete("/api/logs/:id", auth, async (req, res) => {
  const result = await FoodLog.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!result) return res.status(404).json({ message: "Log not found." });
  res.json({ message: "Food entry deleted." });
});

const port = process.env.PORT || 5000;
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes("replace_this")) {
  console.warn("WARNING: Set a unique JWT_SECRET in server/.env before real use.");
}
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nutrition_assistant")
  .then(() => {
    console.log("MongoDB connected");
    app.listen(port, () => console.log(`API running at http://localhost:${port}`));
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
