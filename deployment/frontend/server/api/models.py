from datetime import datetime
from typing import Literal,Any
from pydantic import BaseModel,ConfigDict,Field

class Scoped(BaseModel):
    model_config=ConfigDict(extra='forbid')
    node:str='F01'
    as_of:datetime|None=None
    start:datetime|None=None
    end:datetime|None=None

class CopilotRequest(Scoped):
    question:str=Field(min_length=1,max_length=2000)

class SimulationRequest(Scoped):
    scenario:Literal['energy_reduction','water_leak','climate_drains','parking_relief']
    parameters:dict[str,float]

class AgentRequest(Scoped):
    limit:int=Field(default=3,ge=1,le=10)

class ComplaintSubmission(Scoped):
    text:str=Field(min_length=3,max_length=4000)

class ComplaintChange(BaseModel):
    model_config=ConfigDict(extra='forbid')
    status:str|None=None
    owner:str|None=None
    category:str|None=None
    urgency:str|None=None
    priority:float|None=Field(default=None,ge=0,le=100)
    resolution_notes:str|None=Field(default=None,max_length=4000)
    reply:str|None=Field(default=None,max_length=4000)

class ComplaintGroup(Scoped):
    ids:list[str]=Field(min_length=1,max_length=100)

class ComplaintBulk(ComplaintGroup):
    changes:ComplaintChange
