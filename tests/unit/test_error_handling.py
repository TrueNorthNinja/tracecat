import os

import pytest
from temporalio.client import WorkflowFailureError

from tests import shared
from tracecat.contexts import ctx_role
from tracecat.dsl.client import get_temporal_client
from tracecat.dsl.common import RETRY_POLICIES, DSLEntrypoint, DSLInput, DSLRunArgs
from tracecat.dsl.models import ActionStatement
from tracecat.dsl.workflow import DSLWorkflow
from tracecat.logger import logger


@pytest.mark.anyio
async def test_execution_fails_fatal(test_role, test_worker_factory):
    dsl = DSLInput.from_yaml("tests/data/workflows/unit_error_fatal.yml")
    test_name = f"test_fatal_execution-{dsl.title}"
    wf_exec_id = shared.generate_test_exec_id(test_name)
    client = await get_temporal_client()
    async with test_worker_factory(client):
        with pytest.raises(WorkflowFailureError) as e:
            await client.execute_workflow(
                DSLWorkflow.run,
                DSLRunArgs(dsl=dsl, role=ctx_role.get(), wf_id=shared.TEST_WF_ID),
                id=wf_exec_id,
                task_queue=os.environ["TEMPORAL__CLUSTER_QUEUE"],
                retry_policy=RETRY_POLICIES["workflow:fail_fast"],
            )
            assert "Couldn't resolve expression 'ACTIONS.a.result.invalid'" in str(e)


@pytest.mark.parametrize(
    "expression, expected_error",
    [
        # ("${{ None > 1}}", "TypeError"),
        # ("${{ NONE }}", "NameError"),
        # ("${{ 1 / 0 }}", "division by zero"),
        # ("${{ [1, 2, 3][10] }}", "Unsupported syntax"),
        # ("${{ SECRETS.path.to.fail }}", "Unsupported syntax"),
        # ("${{ FN.sum('not a list') }}", "TypeError"),
        # ("${{ ACTIONS.a.result.invalid }} }}", "Test"),
        # ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        # (
        #     "${{ ACTIONS.undefined_action.result }}",
        #     "Couldn't resolve expression 'ACTIONS.undefined_action.result'",
        # ),
        # (
        #     "${{ FN.nonexistent_function(1, 2) }}",
        #     "Unknown function 'nonexistent_function'",
        # ),
        # ("${{ 'string' + 5 }}", "unsupported operand type(s) for +: 'str' and 'int'"),
        # ("${{ {'key': 'value'}['nonexistent'] }}", "KeyError"),
        # (
        #     "${{ INPUTS.undefined_input }}",
        #     "Couldn't resolve expression 'INPUTS.undefined_input'",
        # ),
        # ("${{ True and 'not boolean' }}", "TypeError"),
        ("${{ 1 if True else }}", "SyntaxError"),
        # ("${{ for x in range(5): print(x) }}", "SyntaxError"),
        # ("${{ lambda x: x * 2 }}", "SyntaxError"),
        ("${{ import os }}", "SyntaxError"),
        ("${{ ACTIONS.path.to[*] }}", "SyntaxError"),
        # ("${{ FN.open('/etc/passwd', 'r') }}", "Unknown function 'open'"),
        # ("${{ __import__('os').system('ls') }}", "NameError"),
        # ("${{ globals() }}", "NameError"),
        # ("${{ FN.eval('1 + 1') }}", "Unknown function 'eval'"),
        # ("${{ FN.exec('print(\"Hello\")') }}", "Unknown function 'exec'"),
    ],
)
@pytest.mark.anyio
@pytest.mark.skip
async def test_execution_fails_invalid_expressions(
    expression, expected_error, test_role, test_worker_factory
):
    dsl = DSLInput(
        title="Testing invalid expressions: " + expected_error,
        description="Testing different invalid expression scenarios",
        entrypoint=DSLEntrypoint(
            ref="failing_action",
        ),
        actions=[
            ActionStatement(
                ref="failing_action",
                action="core.transform.reshape",
                args={
                    "value": {"data": expression},
                },
                depends_on=[],
                description="",
            ),
        ],
        inputs={},
        returns=None,
        triggers=[],
    )
    test_name = f"test_execution_fails_invalid_expressions-{dsl.title}"
    wf_exec_id = shared.generate_test_exec_id(test_name)
    client = await get_temporal_client()
    async with test_worker_factory(client):
        with pytest.raises(WorkflowFailureError):
            result = await client.execute_workflow(
                DSLWorkflow.run,
                DSLRunArgs(dsl=dsl, role=test_role, wf_id=shared.TEST_WF_ID),
                id=wf_exec_id,
                task_queue=os.environ["TEMPORAL__CLUSTER_QUEUE"],
                retry_policy=RETRY_POLICIES["workflow:fail_fast"],
            )
            logger.info(result)
