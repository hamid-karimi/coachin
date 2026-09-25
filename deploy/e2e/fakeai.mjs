// Fake Anthropic Messages API for the e2e suite (compose.e2e.yaml): answers each
// prompt the API sends with a fixed, valid result, streamed like the real API.
import http from "node:http";
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const request = JSON.parse(body || "{}");
    const content = request.messages?.[0]?.content ?? [];
    const prompt = content.find((block) => block.type === "text")?.text ?? "";
    const images = content.filter((block) => block.type === "image").length;
    const weeks = Number((prompt.match(/Create a (\d+)-week/) || [])[1] || 8);
    const items = [];
    for (let week = 1; week <= weeks; week++) {
      for (const day of [1, 3, 5]) items.push({ week, day_of_week: day, item_type: "run", title: `Easy run w${week}`, details: { distance_km: 5 + week, pace_min_km: "6:00", notes: "Relaxed" } });
      items.push({ week, day_of_week: 4, item_type: "strength", title: "Strength — hips", description: "Single-leg RDL 3x10", details: { video_query: "single leg rdl form" } });
    }
    let answer = { summary: "A steady fake plan.", items };
    if (prompt.startsWith("These are fitness progress photos")) {
      answer = { build_notes: `Athletic build (${images} photos).`, posture_notes: "Slight anterior pelvic tilt.", training_considerations: ["Glute bridges", "Hip flexor stretches"] };
    } else if (prompt.startsWith("Extract body-composition metrics")) {
      answer = { weight_kg: 74.2, body_fat_pct: 16.5, muscle_mass_kg: 35.1, notes: "InBody 570 scan" };
    } else if (prompt.includes("Classify this image for a fitness app")) {
      // Wide images are reports, square ones "explicit", tall ones body photos.
      const jpeg = Buffer.from(content.find((block) => block.type === "image").source.data, "base64");
      let w = 0, h = 0;
      for (let i = 2; i < jpeg.length - 8; ) {
        const marker = jpeg[i + 1], size = jpeg.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xc2) { h = jpeg.readUInt16BE(i + 5); w = jpeg.readUInt16BE(i + 7); break; }
        i += 2 + size;
      }
      const category = w > h ? "analysis_report" : w === h ? "rejected_nudity" : "body_photo";
      answer = { category, reason: `fake ${w}x${h}` };
    } else if (prompt.includes("meal photo") || prompt.includes("show the SAME meal")) {
      answer = { items: [
        { name: "Grilled chicken", est_quantity_g: 150, est_kcal: 248, protein_g: 46, carbs_g: 0, fat_g: 5 },
        { name: "White rice", est_quantity_g: 180, est_kcal: 234, protein_g: 4, carbs_g: 51, fat_g: 0 },
      ] };
    } else if (prompt.includes("Design a 7-day meal plan")) {
      const slots = [["breakfast", "Oat bowl", 450], ["lunch", "Chicken rice bowl", 650], ["dinner", "Salmon & potatoes", 700]];
      answer = { items: [0, 1, 2, 3, 4, 5, 6].flatMap((day) => slots.map(([meal_type, title, kcal]) => ({
        day_of_week: day, meal_type, title: `${title} d${day}`, kcal, protein_g: 35, carbs_g: 60, fat_g: 15,
        ingredients: [{ name: "Oats", qty: "80 g" }, { name: "Chicken breast", qty: "150 g" }],
        recipe: "Cook and combine.", video_query: `${title} recipe`,
      }))) };
    } else if (prompt.startsWith("An athlete just logged")) {
      answer = { message: "Solid session — keep the easy days easy.", flag: "ok" };
    } else if (prompt.startsWith("You are adjusting ONE week")) {
      const week = Number((prompt.match(/\(week (\d+)\)/) || [])[1] || 2);
      answer = {
        summary: "Runs grow by about 10% since last week went well.",
        items: [1, 3, 5].map((day) => ({ week, day_of_week: day, item_type: "run", title: `Adjusted run d${day}`, details: { distance_km: 7.5, pace_min_km: "6:00" } })),
      };
    }
    const text = "```json\n" + JSON.stringify(answer) + "\n```";
    console.log("request:", prompt.slice(0, 40), "| images", images, "| model", request.model);
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const send = (e) => res.write(`event: ${e.type}
data: ${JSON.stringify(e)}

`);
    send({ type: "message_start", message: { id: "msg_fake", type: "message", role: "assistant", model: request.model, content: [], usage: { input_tokens: 1, output_tokens: 0 } } });
    send({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
    send({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } });
    send({ type: "content_block_stop", index: 0 });
    send({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 10 } });
    send({ type: "message_stop" });
    res.end();
  });
}).listen(8000, () => console.log("fake anthropic on :8000"));
