import fs from "node:fs";
import path from "node:path";

const [
  ,
  ,
  idArg,
  nameArg,
  iconArg = "🎮",
  categoryArg = "未分类",
  descArg = "待补充",
] = process.argv;

if (!idArg || !nameArg) {
  console.error(
    "Usage: npm run new:game -- <id> <name> [icon] [category] [desc]",
  );
  process.exit(1);
}

const id = idArg.trim();
const name = nameArg.trim();
if (!/^[a-z0-9_-]+$/.test(id)) {
  console.error("Game id must match ^[a-z0-9_-]+$");
  process.exit(1);
}

const rootDir = process.cwd();
const templatePath = path.join(
  rootDir,
  "data",
  "templates",
  "game.template.json",
);
const indexPath = path.join(rootDir, "data", "games.json");
const gamePath = path.join(rootDir, "data", "games", `${id}.json`);

if (fs.existsSync(gamePath)) {
  console.error(`Game file already exists: data/games/${id}.json`);
  process.exit(1);
}

const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
template.title = name;
template.subtitle = `${name} 的剧情草稿`;

const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
if ((index.games || []).some((game) => game.id === id)) {
  console.error(`Game id already exists in data/games.json: ${id}`);
  process.exit(1);
}

index.games.push({
  id,
  file: `data/games/${id}.json`,
  name,
  icon: iconArg,
  desc: descArg,
  category: categoryArg,
});

fs.writeFileSync(gamePath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

console.log(`Created data/games/${id}.json`);
console.log(`Registered ${id} in data/games.json`);
