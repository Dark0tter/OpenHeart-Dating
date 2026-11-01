import { PrismaClient } from "@prisma/client";
import {
  ACCESSIBILITY_TAGS,
  BODY_TAGS,
  categoryTier,
  ETHNICITY_TAGS,
  interestTier,
  GOAL_TAGS,
  IDENTITY_TAGS,
  INTEREST_CATEGORIES,
  INTEREST_CATEGORY_NOTES,
  ORIENTATION_TAGS,
  RELATIONSHIP_STYLE_TAGS,
  slugify,
} from "../src/lib/constants/tags";

const prisma = new PrismaClient();

async function main() {
  for (const label of IDENTITY_TAGS) {
    await prisma.identityTag.upsert({
      where: { slug: slugify(label) },
      create: { slug: slugify(label), label },
      update: { label },
    });
  }

  for (const label of ORIENTATION_TAGS) {
    await prisma.orientationTag.upsert({
      where: { slug: slugify(label) },
      create: { slug: slugify(label), label },
      update: { label },
    });
  }

  for (const label of GOAL_TAGS) {
    await prisma.goalTag.upsert({
      where: { slug: slugify(label) },
      create: { slug: slugify(label), label },
      update: { label },
    });
  }

  for (const label of RELATIONSHIP_STYLE_TAGS) {
    await prisma.relationshipStyleTag.upsert({
      where: { slug: slugify(label) },
      create: { slug: slugify(label), label },
      update: { label },
    });
  }

  for (const label of BODY_TAGS) {
    await prisma.bodyTag.upsert({
      where: { slug: slugify(label) },
      create: { slug: slugify(label), label },
      update: { label },
    });
  }

  for (const label of ETHNICITY_TAGS) {
    await prisma.ethnicityTag.upsert({
      where: { slug: slugify(label) },
      create: { slug: slugify(label), label },
      update: { label },
    });
  }

  for (const label of ACCESSIBILITY_TAGS) {
    await prisma.accessibilityTag.upsert({
      where: { slug: slugify(label) },
      create: { slug: slugify(label), label },
      update: { label },
    });
  }

  for (const [categoryName, names] of Object.entries(INTEREST_CATEGORIES)) {
    const categorySlug = slugify(categoryName);
    const description = INTEREST_CATEGORY_NOTES[categoryName] ?? null;
    const tier = categoryTier(categoryName);
    const category = await prisma.interestCategory.upsert({
      where: { slug: categorySlug },
      create: { slug: categorySlug, name: categoryName, description, tier },
      update: { name: categoryName, description, tier },
    });
    for (const name of new Set(names)) {
      const slug = slugify(`${categoryName}-${name}`);
      const tier = interestTier(categoryName, name);
      await prisma.interest.upsert({
        where: { slug },
        create: { slug, name, categoryId: category.id, tier },
        update: { name, categoryId: category.id, tier },
      });
    }
  }

  await prisma.chatRoom.upsert({
    where: { slug: "welcome" },
    create: {
      slug: "welcome",
      name: "Welcome & introductions",
      description: "Say hi, introduce yourself, and meet new members.",
      kind: "GENERAL",
    },
    update: {},
  });

  for (const category of await prisma.interestCategory.findMany()) {
    const description = [
      `For members interested in ${category.name}.`,
      category.description,
    ]
      .filter(Boolean)
      .join(" ");
    await prisma.chatRoom.upsert({
      where: { slug: `interest-${category.slug}` },
      create: {
        slug: `interest-${category.slug}`,
        name: category.name,
        description,
        kind: "INTEREST_CATEGORY",
        interestCategoryId: category.id,
      },
      update: { name: category.name, description, interestCategoryId: category.id },
    });
  }

  for (const goal of await prisma.goalTag.findMany()) {
    await prisma.chatRoom.upsert({
      where: { slug: `goal-${goal.slug}` },
      create: {
        slug: `goal-${goal.slug}`,
        name: goal.label,
        description: `For members looking for ${goal.label.toLowerCase()}.`,
        kind: "GOAL",
        goalTagId: goal.id,
      },
      update: { name: goal.label, goalTagId: goal.id },
    });
  }

  console.log("Seeded tag taxonomies and chat rooms.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
