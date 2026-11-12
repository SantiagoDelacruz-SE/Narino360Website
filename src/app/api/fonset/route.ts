import { NextResponse } from "next/server";
import {
  actor,
  body,
  editor,
  errorResponse,
  identity,
  sameOrigin,
} from "@/lib/http";
import { AppError } from "@/lib/domain";
import { positiveId } from "@/lib/impact-domain";
import { fonsetSubmissionId, validateFonsetProject } from "@/lib/fonset-domain";
import {
  createFonsetProject,
  deleteFonsetProject,
  listFonsetProjects,
  updateFonsetProject,
} from "@/lib/fonset";
export const runtime = "nodejs";
export async function GET() {
  try {
    await identity();
    return NextResponse.json({ projects: listFonsetProjects() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor(),
      value = await body(request);
    const result = createFonsetProject(
      validateFonsetProject(value),
      actor(user),
      user.role,
      fonsetSubmissionId(value.submissionId),
    );
    return NextResponse.json(result, { status: result.reused ? 200 : 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor(),
      value = await body(request);
    const project = updateFonsetProject(
      positiveId(value.id),
      validateFonsetProject(value),
      actor(user),
      user.role,
    );
    return NextResponse.json({ project });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor();
    if (user.role !== "Administrador")
      throw new AppError(
        "Solo el administrador puede eliminar proyectos FONSET.",
        403,
      );
    const value = await body(request);
    deleteFonsetProject(positiveId(value.id), actor(user), user.role);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
