/**
 * Sort of a limiting-queue - only N Tasks can be executed at the same time,
 * and all other requests will wait their turn.
 *
 * All waiting requests will be collected into a single Task when a slot is
 * available.
 *
 * I really hope extensions are single-threaded, because otherwise this will
 * probably not work.
 */
export class TaskGroupingExecutor<Task> {
    readonly concurrent_limit: number;
    readonly pending = new Set<Task>();
    readonly task_handler: (tasks: Iterable<Task>) => Promise<void>;

    active_tasks: number = 0;

    constructor(limit: number, task_handler: (tasks: Iterable<Task>) => Promise<void>) {
        this.concurrent_limit = limit;
        this.task_handler = task_handler;
    }

    addTask(task: Task) {
        this.pending.add(task);
        if (this.active_tasks < this.concurrent_limit) {
            // triggering, but no waiting!
            this.triggerHandler();
        }
    }

    async triggerHandler() {
        while (this.active_tasks < this.concurrent_limit && this.pending.size) {
            const tasks = Array.from(this.pending);
            this.pending.clear();

            this.active_tasks ++;
            await this.task_handler(tasks);
            this.active_tasks --;
        }
    }
}
