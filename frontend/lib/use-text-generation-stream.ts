"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type {
  GenerationStreamEvent,
  GenerationTask,
  Project,
  TextGenerationStreamState,
  TextStreamStage
} from "@/lib/api-types";

const INITIAL_STATE: TextGenerationStreamState = {
  error: null,
  stage: null,
  status: "idle",
  task: null,
  text: ""
};

export interface TextGenerationController {
  cancel: () => void;
  retry: (task: GenerationTask) => Promise<void>;
  start: (stage: TextStreamStage) => Promise<void>;
  state: TextGenerationStreamState;
}

export function useTextGenerationStream({
  onProjectUpdated,
  onStageStart,
  project
}: {
  onProjectUpdated: (project: Project) => void;
  onStageStart: (stage: TextStreamStage) => void;
  project: Project;
}): TextGenerationController {
  const [state, setState] =
    useState<TextGenerationStreamState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);
  const projectIdRef = useRef(project.id);

  const run = useCallback(
    async (
      stage: TextStreamStage,
      request: (
        onEvent: (event: GenerationStreamEvent) => void,
        signal: AbortSignal
      ) => Promise<void>
    ) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      onStageStart(stage);
      setState({
        error: null,
        stage,
        status: "streaming",
        task: null,
        text: ""
      });

      let completed = false;
      try {
        await request((event) => {
          if (controller.signal.aborted) return;
          if (event.type === "task") {
            setState((current) => ({ ...current, task: event.task }));
          } else if (event.type === "delta") {
            setState((current) => ({
              ...current,
              text: current.text + event.text
            }));
          } else if (event.type === "complete") {
            completed = true;
            setState((current) => ({
              ...current,
              status: "completed",
              task: event.task
            }));
          }
        }, controller.signal);
        if (!completed || controller.signal.aborted) return;
        const freshProject = await apiClient.getProject(project.id, {
          cache: "no-store",
          signal: controller.signal
        });
        onProjectUpdated(freshProject);
        setState(INITIAL_STATE);
      } catch (error) {
        if (controller.signal.aborted) {
          setState(INITIAL_STATE);
          return;
        }
        setState({
          error: getUserFacingErrorMessage(error),
          stage,
          status: "failed",
          task: null,
          text: ""
        });
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [onProjectUpdated, onStageStart, project.id]
  );

  const start = useCallback(
    (stage: TextStreamStage) =>
      run(stage, (onEvent, signal) =>
        apiClient.streamGenerationStage(project.id, stage, onEvent, { signal })
      ),
    [project.id, run]
  );

  const retry = useCallback(
    (task: GenerationTask) => {
      if (!isTextStreamStage(task.stage)) {
        throw new Error(`stage ${task.stage} does not support text streaming`);
      }
      return run(task.stage, (onEvent, signal) =>
        apiClient.retryTextTask(task.id, onEvent, { signal })
      );
    },
    [run]
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  useEffect(() => {
    if (projectIdRef.current !== project.id) {
      projectIdRef.current = project.id;
      cancel();
    }
  }, [cancel, project.id]);

  useEffect(() => cancel, [cancel]);

  return { cancel, retry, start, state };
}

export function isTextStreamStage(
  stage: string
): stage is TextStreamStage {
  return stage === "story" || stage === "script" || stage === "storyboard";
}
