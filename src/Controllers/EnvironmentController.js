const CanvasController = require("./CanvasController");
const Organism = require('../Organism/Organism');
const Modes = require("./ControlModes");
const CellStates = require("../Organism/Cell/CellStates");
const Neighbors = require("../Grid/Neighbors");
const FossilRecord = require("../Stats/FossilRecord");
const Hyperparams = require("../Hyperparameters");

class EnvironmentController extends CanvasController{
    constructor(env, canvas) {
        super(env, canvas);
        this.mode = Modes.Drag;
        this.org_to_clone = null;
        this.add_new_species = false;
        this.defineZoomControls();
        this.scale = 1;
    }

    defineZoomControls() {
          var scale = 1;
          var zoom_speed = 0.5;
          const el = document.querySelector('#env-canvas');
          el.onwheel = function zoom(event) {
            event.preventDefault();

            var sign = -Math.sign(event.deltaY);

            // Restrict scale
            scale = Math.max(0.5, this.scale+(sign*zoom_speed));

            var cur_top = parseInt($('#env-canvas').css('top'));
            var cur_left = parseInt($('#env-canvas').css('left'));

            var diff_x = (this.canvas.width/2  - this.mouse_x) * (scale - this.scale);
            var diff_y = (this.canvas.height/2 - this.mouse_y) * (scale - this.scale);

            $('#env-canvas').css('top', (cur_top+diff_y)+'px');
            $('#env-canvas').css('left', (cur_left+diff_x)+'px');
          
            // Apply scale transform
            el.style.transform = `scale(${scale})`;
            this.scale = scale;

          }.bind(this);
    }

    resetView() {
        $('#env-canvas').css('transform', 'scale(1)');
        $('#env-canvas').css('top', '0px');
        $('#env-canvas').css('left', '0px');
        this.scale = 1;
    }

    updateMouseLocation(offsetX, offsetY){
        
        super.updateMouseLocation(offsetX, offsetY);
    }

    mouseMove() {
        this.performModeAction();
    }

    mouseDown() {
        this.start_x = this.mouse_x;
        this.start_y = this.mouse_y;
        this.performModeAction();
    }

    mouseUp() {

    }

    performModeAction() {
        if (Hyperparams.headless)
            return;
        var mode = this.mode;
        var right_click = this.right_click;
        var left_click = this.left_click;
        if (mode != Modes.None && (right_click || left_click)) {
            var cell = this.cur_cell;
            if (cell == null){
                return;
            }
            switch(mode) {
                case Modes.FoodDrop:
                    if (left_click){
                        this.dropCellType(cell.col, cell.row, CellStates.food, false);
                    }
                    else if (right_click){
                        this.dropCellType(cell.col, cell.row, CellStates.empty, false);
                    }
                    break;
                case Modes.WallDrop:
                        if (left_click){
                            this.dropCellType(cell.col, cell.row, CellStates.wall, true);

                        }
                        else if (right_click){
                            this.dropCellType(cell.col, cell.row, CellStates.empty, false);
                        }
                        break;
				case Modes.WaterDrop:
					if (left_click){
						this.env.water_map[cell.col][cell.row] = true
						for (var loc of Neighbors.allSelf){
							var c=cell.col + loc[0];
							var r=cell.row + loc[1];
							this.env.water_map[c][r] = true
						}
						
						this.dropCellType(cell.col, cell.row, CellStates.water, true);

					}
					else if (right_click){
						this.env.water_map[cell.col][cell.row] = false
						for (var loc of Neighbors.allSelf){
							var c=cell.col + loc[0];
							var r=cell.row + loc[1];
							this.env.water_map[c][r] = false
						}
						this.dropCellType(cell.col, cell.row, CellStates.empty, false);
					}
					break;
                case Modes.ClickKill:
                    this.killNearOrganisms();
                    break;

                case Modes.Select:
                    if (this.cur_org == null) {
                        this.cur_org = this.findNearOrganism();
                    }
                    if (this.cur_org != null){
                        this.control_panel.setEditorOrganism(this.cur_org);
                    }
                    break;

                case Modes.Clone:
                    if (this.org_to_clone != null){
                        var new_org = new Organism(this.mouse_c, this.mouse_r, this.env, this.org_to_clone);
                        if (this.add_new_species){
                            FossilRecord.addSpeciesObj(new_org.species);
                            new_org.species.start_tick = this.env.total_ticks;
                            this.add_new_species = false;
                            new_org.species.population = 0;
                        }
                        else if (this.org_to_clone.species.extinct){
                            FossilRecord.resurrect(this.org_to_clone.species);
                        }

                        if (new_org.isClear(this.mouse_c, this.mouse_r)){
                            this.env.addOrganism(new_org);
                            new_org.species.addPop();
                        }
                    }
                    break;
                case Modes.Drag:
                    var cur_top = parseInt($('#env-canvas').css('top'), 10);
                    var cur_left = parseInt($('#env-canvas').css('left'), 10);
                    var new_top = cur_top + ((this.mouse_y - this.start_y)*this.scale);
                    var new_left = cur_left + ((this.mouse_x - this.start_x)*this.scale);
                    $('#env-canvas').css('top', new_top+'px');
                    $('#env-canvas').css('left', new_left+'px');
                    break;
            }
        }
        else if (this.middle_click) {
            //drag on middle click
            var cur_top = parseInt($('#env-canvas').css('top'), 10);
            var cur_left = parseInt($('#env-canvas').css('left'), 10);
            var new_top = cur_top + ((this.mouse_y - this.start_y)*this.scale);
            var new_left = cur_left + ((this.mouse_x - this.start_x)*this.scale);
            $('#env-canvas').css('top', new_top+'px');
            $('#env-canvas').css('left', new_left+'px');
        }
    }

    dropCellType(col, row, state, killBlocking=false) {
        for (var loc of Neighbors.allSelf){
            var c=col + loc[0];
            var r=row + loc[1];
            var cell = this.env.grid_map.cellAt(c, r);
            if (cell == null)
                continue;
            if (killBlocking && cell.owner != null){
                cell.owner.die();
            }
            else if (cell.owner != null) {
                continue;
            }
            this.env.changeCell(c, r, state, null);
        }
    }

    findNearOrganism() {
        for (var loc of Neighbors.all){
            var c = this.cur_cell.col + loc[0];
            var r = this.cur_cell.row + loc[1];
            var cell = this.env.grid_map.cellAt(c, r);
            if (cell != null && cell.owner != null)
                return cell.owner;
        }
        return null;
    }

    killNearOrganisms() {
        for (var loc of Neighbors.allSelf){
            var c = this.cur_cell.col + loc[0];
            var r = this.cur_cell.row + loc[1];
            var cell = this.env.grid_map.cellAt(c, r);
            if (cell != null && cell.owner != null)
                cell.owner.die();
        }
    }


}

module.exports = EnvironmentController;
