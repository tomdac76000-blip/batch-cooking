const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const emptyState = () => ({ profile: {}, history: [], measurements: [], fridge: [] });
const clientId = request => request.headers.get('x-batch-client')?.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80);
const stateKey = id => `batch:state:${id}`;
const recipesKey = id => `batch:recipes:${id}`;
async function read(store, key, fallback) { return (await store.get(key, 'json')) ?? fallback; }
async function write(store, key, value) { await store.put(key, JSON.stringify(value)); }
async function requestBody(request) { try { return await request.json(); } catch { return {}; } }
function requireStore(env, request) {
  const id = clientId(request);
  return env.BATCH_KV && id ? { store: env.BATCH_KV, id } : null;
}
function mealDraft(meal) {
  const ingredients = [];
  for (let index = 1; index <= 20; index++) {
    const ingredient = String(meal[`strIngredient${index}`] || '').trim();
    const measure = String(meal[`strMeasure${index}`] || '').trim();
    if (ingredient) ingredients.push(`${measure ? `${measure} ` : ''}${ingredient}`.trim());
  }
  const steps = String(meal.strInstructions || '').split(/\r?\n|(?<=[.!?])\s+(?=[A-Z])/).map(step => step.trim()).filter(step => step.length > 18).slice(0, 10);
  return { name: meal.strMeal, meal: 'dinner', image: meal.strMealThumb, ingredients, steps: steps.length ? steps : ['Prépare les ingrédients puis suis la recette source.'], source: `Fiche trouvée : ${meal.strSource || 'TheMealDB'}` };
}
async function suggestion(query) {
  const normalized = query.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const aliases = { pate: 'pasta', pates: 'pasta', creme: 'creamy', poulet: 'chicken', boeuf: 'beef', saumon: 'salmon', thon: 'tuna', poisson: 'fish', riz: 'rice', nouille: 'noodles', nouilles: 'noodles', curry: 'curry', sandwich: 'sandwich', wrap: 'wrap', salade: 'salad', fromage: 'cheese', tomate: 'tomato', legume: 'vegetable', legumes: 'vegetable' };
  const tokens = normalized.split(/[^a-z]+/).filter(token => token.length > 2);
  const terms = [query, ...tokens.map(token => aliases[token] || token)].filter((term, index, list) => term && list.indexOf(term) === index).slice(0, 6);
  const responses = await Promise.all(terms.map(async term => { try { const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(term)}`); return (await response.json()).meals || []; } catch { return []; } }));
  const needle = [...tokens, ...tokens.map(token => aliases[token]).filter(Boolean)];
  const meals = responses.flat().filter((meal, index, list) => list.findIndex(item => item.idMeal === meal.idMeal) === index).sort((a, b) => {
    const score = meal => needle.reduce((sum, word) => sum + (String(meal.strMeal).toLowerCase().includes(word) ? 3 : String(meal.strCategory || '').toLowerCase().includes(word) ? 1 : 0), 0);
    return score(b) - score(a);
  }).slice(0, 5);
  return meals.map(mealDraft);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/health') return json({ ok: true, storage: Boolean(env.BATCH_KV) });
    if (url.pathname === '/api/recipe-suggest' && request.method === 'GET') {
      const query = url.searchParams.get('name')?.trim();
      if (!query) return json({ error: 'Nom requis' }, 400);
      const candidates = await suggestion(query);
      return candidates.length ? json({ query, candidates }) : json({ error: 'Aucune idée proche trouvée. Crée-la en version complète.' }, 404);
    }
    const context = requireStore(env, request);
    if (!context) return json({ error: 'Stockage non configuré' }, 503);
    const { store, id } = context;
    if (url.pathname === '/api/recipes') {
      const key = recipesKey(id);
      if (request.method === 'GET') return json(await read(store, key, []));
      if (request.method === 'POST') {
        const payload = await requestBody(request), name = String(payload.name || '').trim();
        if (!name) return json({ error: 'Nom requis' }, 400);
        const recipe = { id: crypto.randomUUID(), name, meal: ['breakfast', 'lunch', 'dinner', 'snack'].includes(payload.meal) ? payload.meal : 'dinner', tags: Array.isArray(payload.tags) ? payload.tags.map(String).slice(0, 12) : [], kcal: Math.max(0, Number(payload.kcal) || 500), protein: Math.max(0, Number(payload.protein) || 25), cost: Math.max(0, Number(payload.cost) || 10), image: String(payload.image || ''), ingredients: Array.isArray(payload.ingredients) ? payload.ingredients.map(String).filter(Boolean).slice(0, 30) : [], steps: Array.isArray(payload.steps) ? payload.steps.map(String).filter(Boolean).slice(0, 20) : [], equipment: Array.isArray(payload.equipment) ? payload.equipment.map(String).slice(0, 5) : [], source: String(payload.source || 'Proposée par toi'), createdAt: new Date().toISOString() };
        const recipes = await read(store, key, []); recipes.unshift(recipe); await write(store, key, recipes); return json(recipe, 201);
      }
    }
    const key = stateKey(id), state = await read(store, key, emptyState());
    state.history ??= []; state.measurements ??= []; state.fridge ??= []; state.profile ??= {};
    if (url.pathname === '/api/me') {
      if (request.method === 'GET') return json(state);
      if (request.method === 'PUT') { state.profile = { ...state.profile, ...await requestBody(request) }; await write(store, key, state); return new Response(null, { status: 204 }); }
    }
    if (url.pathname === '/api/plans' && request.method === 'POST') {
      const payload = await requestBody(request), createdAt = new Date().toISOString(), plan = { id: crypto.randomUUID(), createdAt, ...payload };
      state.history.unshift(plan);
      for (const item of payload.fridgeItems || []) { const total = Math.max(1, Number(item.total) || 4), fresh = Math.min(total, Math.max(0, Number(item.fresh) || 0)); state.fridge.unshift({ id: crypto.randomUUID(), planId: plan.id, createdAt, recipeName: String(item.recipeName || 'Recette'), total, remaining: total, fresh, frozen: total - fresh }); }
      await write(store, key, state); return json(plan, 201);
    }
    if (url.pathname === '/api/fridge' && request.method === 'GET') return json(state.fridge);
    if (url.pathname.startsWith('/api/fridge/') && request.method === 'PATCH') {
      const item = state.fridge.find(row => row.id === url.pathname.split('/').pop());
      if (!item) return new Response(null, { status: 404 });
      const changes = await requestBody(request); for (const field of ['remaining', 'fresh', 'frozen']) if (Number.isFinite(Number(changes[field]))) item[field] = Math.max(0, Number(changes[field]));
      await write(store, key, state); return json(item);
    }
    if (url.pathname === '/api/measurements' && request.method === 'POST') { const measurement = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...await requestBody(request) }; state.measurements.unshift(measurement); await write(store, key, state); return json(measurement, 201); }
    return json({ error: 'Introuvable' }, 404);
  }
};
