
/*
 *  Copyright 2018-2024 Felix Garcia Carballeira, Diego Camarmas Alonso, Alejandro Calderon Mateos
 *
 *  This file is part of CREATOR.
 *
 *  CREATOR is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Lesser General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  CREATOR is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public License
 *  along with CREATOR.  If not, see <http://www.gnu.org/licenses/>.
 *
 */


  /* jshint esversion: 6 */

  var uielto_load_library = {

        props:      {
                      id:                  { type: String, required: true }
                    },

        data:       function () {
                      return {
                        //Binary code loaded
                        name_binary_load: ''
                      }
                    },

        methods:    {
                      library_update(){
                        if (code_binary.length !== 0){
                            update_binary = JSON.parse(code_binary);
                            load_binary = true;
                            $("#divAssembly").attr("class", "col-lg-10 col-sm-12");
                            $("#divTags").attr("class", "col-lg-2 col-sm-12");
                            $("#divTags").show();
                            show_notification("The selected library has been loaded correctly", 'success');
                        }
                        else{
                            show_notification("Please select one library", 'danger');
                        }
                      },

                      //Load binary file
                      library_load(e){
                        var file;
                        var reader;
                        var files = document.getElementById('binary_file').files;

                        for (var i = 0; i < files.length; i++) {
                             file = files[i];
                             reader = new FileReader();
                             reader.onloadend = onFileLoaded;
                             reader.readAsText(file);
                        }

                        function onFileLoaded(event) {
                           code_binary = event.currentTarget.result;
                        }
                      },
                    },

        template:   ' <b-modal  :id = "id"' +
                    '           title = "Load Binary" ' +
                    '           ok-title="Load from this File" ' +
                    '           @ok="library_update">' +
                    ' ' +
                    '   <p> Please select the binary file to be loaded </p> ' +
                    '   <b-form-file v-model="name_binary_load" ' +
                    '                :state="Boolean(name_binary_load)" ' +
                    '                placeholder="Choose a file..." ' +
                    '                accept=".o" ' +
                    '                @change="library_load" ' +
                    '                id="binary_file">' +
                    '   </b-form-file>' +
                    ' </b-modal>'
  }

  Vue.component('load-library', uielto_load_library) ;
