import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--guest",
        choices=("guest-01", "guest-02", "guest-03", "guest-04", "guest-05"),
        default="guest-01",
    )
    parser.add_argument("--output-root", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def material(name, color, roughness=0.72, metallic=0.0):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.use_nodes = True
    principled = value.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    return value


def assign_material(obj, value):
    obj.data.materials.append(value)


def smooth(obj):
    if hasattr(obj.data, "polygons"):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def sphere(name, location, scale, value, parent=None, segments=48, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.scale = scale
    assign_material(obj, value)
    return smooth(obj)


def cylinder(name, location, radius, depth, value, parent=None, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    assign_material(obj, value)
    return smooth(obj)


def cone(name, location, radius_bottom, radius_top, depth, value, parent=None, vertices=64):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
        location=(0, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    assign_material(obj, value)
    return smooth(obj)


def rounded_cube(name, location, scale, value, parent=None, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.scale = scale
    assign_material(obj, value)
    modifier = obj.modifiers.new("Soft edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 4
    return obj


def curve(name, points, value, bevel_depth, parent=None, cyclic=False):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 3
    data.bevel_resolution = 3
    data.bevel_depth = bevel_depth
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    assign_material(obj, value)
    return obj


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.12
    obj.location = location
    obj.parent = parent
    return obj


def build_guest01_character():
    skin = material("Skin", (0.96, 0.72, 0.62))
    blush = material("Blush", (1.0, 0.48, 0.48), roughness=0.9)
    hair = material("Dark brown hair", (0.12, 0.045, 0.025), roughness=0.38)
    hair_highlight = material("Hair highlight", (0.28, 0.10, 0.055), roughness=0.42)
    cream = material("Cream bolero", (0.93, 0.88, 0.79))
    dress = material("Blush lace dress", (0.92, 0.68, 0.65))
    lace = material("Lace detail", (1.0, 0.88, 0.84))
    belt = material("Taupe belt", (0.52, 0.36, 0.31))
    shoe = material("Beige shoes", (0.52, 0.37, 0.31), roughness=0.5)
    bag = material("Beige handbag", (0.55, 0.39, 0.32), roughness=0.58)
    gold = material("Warm gold", (0.78, 0.48, 0.08), roughness=0.32, metallic=0.72)
    eye_white = material("Eye white", (0.98, 0.98, 0.97), roughness=0.25)
    iris = material("Warm brown iris", (0.20, 0.07, 0.025), roughness=0.28)
    pupil = material("Pupil", (0.012, 0.008, 0.006), roughness=0.2)
    pearl = material("Pearl", (0.96, 0.92, 0.86), roughness=0.2, metallic=0.04)
    mouth = material("Mouth", (0.55, 0.10, 0.09), roughness=0.6)

    root = empty("Guest01_Master")

    sphere("Head", (0, -0.01, 2.50), (0.53, 0.46, 0.52), skin, root)
    sphere("Left ear", (-0.50, -0.01, 2.47), (0.10, 0.07, 0.14), skin, root)
    sphere("Right ear", (0.50, -0.01, 2.47), (0.10, 0.07, 0.14), skin, root)

    sphere("Hair back", (0, 0.17, 2.54), (0.58, 0.47, 0.57), hair, root)
    sphere("Hair left crown", (-0.23, -0.18, 2.78), (0.35, 0.25, 0.25), hair_highlight, root)
    sphere("Hair right crown", (0.23, -0.18, 2.78), (0.35, 0.25, 0.25), hair_highlight, root)
    for index, x in enumerate((-0.48, -0.32, -0.16, 0.0, 0.16, 0.32, 0.48)):
        depth = 0.23 + 0.06 * (1.0 - abs(x) / 0.5)
        sphere(
            f"Back wave {index + 1}",
            (x, 0.27 + (0.03 if index % 2 else 0), 2.12 - 0.04 * (index % 2)),
            (0.16, depth, 0.34),
            hair if index % 2 else hair_highlight,
            root,
            segments=36,
            rings=24,
        )
    for side in (-1, 1):
        curve(
            f"Face curl {side}",
            [
                (0.39 * side, -0.31, 2.78),
                (0.53 * side, -0.28, 2.50),
                (0.49 * side, -0.25, 2.18),
                (0.55 * side, -0.20, 1.99),
            ],
            hair_highlight,
            0.055,
            root,
        )
    braid_points = []
    for index in range(13):
        x = -0.48 + index * 0.08
        z = 2.49 - 0.12 * (1.0 - (x / 0.48) ** 2)
        braid_points.append((x, 0.56, z))
    curve("Back braid", braid_points, hair_highlight, 0.065, root)

    for side in (-1, 1):
        sphere(f"Eye white {side}", (0.205 * side, -0.438, 2.57), (0.145, 0.035, 0.115), eye_white, root, 36, 24)
        sphere(f"Iris {side}", (0.205 * side, -0.470, 2.56), (0.078, 0.022, 0.082), iris, root, 32, 20)
        sphere(f"Pupil {side}", (0.205 * side, -0.487, 2.555), (0.038, 0.012, 0.047), pupil, root, 24, 16)
        sphere(f"Eye highlight {side}", (0.180 * side, -0.500, 2.59), (0.016, 0.008, 0.020), eye_white, root, 20, 12)
        curve(
            f"Eyebrow {side}",
            [(0.10 * side, -0.472, 2.72), (0.21 * side, -0.488, 2.75), (0.32 * side, -0.468, 2.72)],
            hair,
            0.015,
            root,
        )
        sphere(f"Cheek {side}", (0.34 * side, -0.445, 2.40), (0.095, 0.014, 0.045), blush, root, 28, 16)
    sphere("Nose", (0, -0.475, 2.46), (0.035, 0.025, 0.045), skin, root, 24, 16)
    curve("Smile", [(-0.075, -0.486, 2.34), (0, -0.503, 2.31), (0.075, -0.486, 2.34)], mouth, 0.012, root)

    sphere("Torso", (0, 0.0, 1.71), (0.36, 0.24, 0.39), dress, root)
    cone("Skirt", (0, 0.04, 0.93), 0.64, 0.34, 1.20, dress, root)
    cylinder("Waist belt", (0, 0.02, 1.52), 0.36, 0.15, belt, root)
    sphere("Left bolero panel", (-0.20, -0.20, 1.80), (0.22, 0.09, 0.31), cream, root)
    sphere("Right bolero panel", (0.20, -0.20, 1.80), (0.22, 0.09, 0.31), cream, root)
    curve("Bolero neckline", [(-0.18, -0.30, 1.98), (0, -0.34, 1.90), (0.18, -0.30, 1.98)], lace, 0.018, root)
    cylinder("Skirt hem", (0, 0.04, 0.35), 0.65, 0.035, lace, root)
    for x in (-0.42, -0.28, -0.14, 0.0, 0.14, 0.28, 0.42):
        curve(
            f"Lace line {x}",
            [(x * 0.56, -0.58, 1.42), (x * 0.78, -0.64, 0.90), (x, -0.56, 0.40)],
            lace,
            0.012,
            root,
        )

    left_arm = empty("Left arm rig", (0.42, 0, 1.90), root)
    right_arm = empty("Right arm rig", (-0.42, 0, 1.90), root)
    for side, rig in ((1, left_arm), (-1, right_arm)):
        cylinder(f"Sleeve {side}", (0.05 * side, 0, -0.28), 0.115, 0.55, cream, rig)
        cylinder(f"Forearm {side}", (0.06 * side, -0.01, -0.61), 0.085, 0.22, skin, rig)
        sphere(f"Hand {side}", (0.06 * side, -0.01, -0.76), (0.095, 0.075, 0.12), skin, rig, 32, 20)

    left_leg = empty("Left leg rig", (0.19, 0, 0.58), root)
    right_leg = empty("Right leg rig", (-0.19, 0, 0.58), root)
    for side, rig in ((1, left_leg), (-1, right_leg)):
        cylinder(f"Leg {side}", (0, 0, -0.24), 0.105, 0.48, skin, rig)
        shoe_obj = rounded_cube(f"Shoe {side}", (0, -0.08, -0.51), (0.15, 0.23, 0.10), shoe, rig, 0.08)
        shoe_obj.rotation_euler.x = math.radians(-4)
        cylinder(f"Heel {side}", (0, 0.07, -0.57), 0.045, 0.13, shoe, rig, 24)

    rounded_cube("Handbag", (-0.68, -0.03, 0.93), (0.22, 0.09, 0.25), bag, root, 0.07)
    curve(
        "Handbag handle",
        [(-0.78, -0.04, 1.16), (-0.71, -0.05, 1.37), (-0.56, -0.05, 1.16)],
        gold,
        0.018,
        root,
    )
    rounded_cube("Handbag clasp", (-0.68, -0.13, 0.94), (0.045, 0.018, 0.055), gold, root, 0.018)

    for side in (-1, 1):
        curve(
            f"Earring link {side}",
            [(0.50 * side, -0.14, 2.42), (0.51 * side, -0.16, 2.34)],
            gold,
            0.012,
            root,
        )
        sphere(f"Pearl earring {side}", (0.51 * side, -0.16, 2.29), (0.055, 0.04, 0.07), pearl, root, 24, 16)
    curve("Necklace", [(-0.15, -0.29, 2.08), (0, -0.34, 2.00), (0.15, -0.29, 2.08)], gold, 0.012, root)
    sphere("Necklace pearl", (0, -0.35, 1.99), (0.035, 0.025, 0.045), pearl, root, 20, 12)

    return root, left_leg, right_leg, left_arm, right_arm


def build_guest02_character():
    skin = material("Skin", (0.96, 0.72, 0.62))
    blush = material("Blush", (1.0, 0.48, 0.48), roughness=0.9)
    hair = material("Deep brown hair", (0.10, 0.038, 0.020), roughness=0.38)
    hair_highlight = material("Warm hair highlight", (0.25, 0.085, 0.040), roughness=0.42)
    ivory = material("Ivory jeogori", (0.96, 0.91, 0.82))
    rose = material("Rose chima", (0.82, 0.42, 0.46))
    rose_light = material("Rose embroidery", (0.98, 0.72, 0.68))
    ribbon = material("Muted rose ribbon", (0.62, 0.28, 0.30))
    sock = material("White beoseon", (0.96, 0.94, 0.90))
    shoe = material("Rose flower shoes", (0.67, 0.28, 0.31), roughness=0.5)
    gold = material("Warm gold", (0.78, 0.48, 0.08), roughness=0.32, metallic=0.72)
    pearl = material("Pearl", (0.96, 0.92, 0.86), roughness=0.2, metallic=0.04)
    flower = material("Hairpin flower", (1.0, 0.82, 0.78), roughness=0.58)
    eye_white = material("Eye white", (0.98, 0.98, 0.97), roughness=0.25)
    iris = material("Warm brown iris", (0.20, 0.07, 0.025), roughness=0.28)
    pupil = material("Pupil", (0.012, 0.008, 0.006), roughness=0.2)
    mouth = material("Mouth", (0.55, 0.10, 0.09), roughness=0.6)

    root = empty("Guest02_Master")

    sphere("Head", (0, -0.01, 2.50), (0.53, 0.46, 0.52), skin, root)
    sphere("Left ear", (-0.50, -0.01, 2.47), (0.10, 0.07, 0.14), skin, root)
    sphere("Right ear", (0.50, -0.01, 2.47), (0.10, 0.07, 0.14), skin, root)

    sphere("Hair back", (0, 0.16, 2.57), (0.58, 0.47, 0.55), hair, root)
    sphere("Hair left crown", (-0.24, -0.19, 2.78), (0.34, 0.24, 0.24), hair_highlight, root)
    sphere("Hair right crown", (0.24, -0.19, 2.78), (0.34, 0.24, 0.24), hair_highlight, root)
    sphere("Low bun", (0, 0.46, 2.28), (0.43, 0.24, 0.29), hair, root)
    for index, x in enumerate((-0.30, -0.15, 0.0, 0.15, 0.30)):
        sphere(
            f"Bun braid {index + 1}",
            (x, 0.64, 2.30 + 0.04 * (1.0 - abs(x) / 0.30)),
            (0.12, 0.075, 0.17),
            hair_highlight if index % 2 == 0 else hair,
            root,
            segments=32,
            rings=20,
        )
    for side in (-1, 1):
        curve(
            f"Face curl {side}",
            [
                (0.39 * side, -0.31, 2.77),
                (0.51 * side, -0.28, 2.52),
                (0.47 * side, -0.25, 2.26),
                (0.51 * side, -0.20, 2.10),
            ],
            hair_highlight,
            0.048,
            root,
        )
    braid_points = []
    for index in range(13):
        x = -0.48 + index * 0.08
        z = 2.51 - 0.12 * (1.0 - (x / 0.48) ** 2)
        braid_points.append((x, 0.56, z))
    curve("Back crown braid", braid_points, hair_highlight, 0.060, root)

    flower_center = (0.37, 0.61, 2.49)
    sphere("Hairpin center", flower_center, (0.075, 0.045, 0.075), gold, root, 24, 16)
    for index in range(6):
        angle = math.radians(index * 60)
        sphere(
            f"Hairpin petal {index + 1}",
            (
                flower_center[0] + math.cos(angle) * 0.105,
                flower_center[1] + 0.015,
                flower_center[2] + math.sin(angle) * 0.105,
            ),
            (0.070, 0.035, 0.105),
            flower,
            root,
            24,
            16,
        )
    for index, offset in enumerate((-0.12, 0.0, 0.12)):
        curve(
            f"Hairpin stem {index + 1}",
            [(0.40 + offset, 0.63, 2.52), (0.49 + offset, 0.64, 2.68)],
            gold,
            0.012,
            root,
        )
        sphere(f"Hairpin pearl {index + 1}", (0.49 + offset, 0.64, 2.70), (0.030, 0.022, 0.038), pearl, root, 18, 12)

    for side in (-1, 1):
        sphere(f"Eye white {side}", (0.205 * side, -0.438, 2.57), (0.145, 0.035, 0.115), eye_white, root, 36, 24)
        sphere(f"Iris {side}", (0.205 * side, -0.470, 2.56), (0.078, 0.022, 0.082), iris, root, 32, 20)
        sphere(f"Pupil {side}", (0.205 * side, -0.487, 2.555), (0.038, 0.012, 0.047), pupil, root, 24, 16)
        sphere(f"Eye highlight {side}", (0.180 * side, -0.500, 2.59), (0.016, 0.008, 0.020), eye_white, root, 20, 12)
        curve(
            f"Eyebrow {side}",
            [(0.10 * side, -0.472, 2.72), (0.21 * side, -0.488, 2.75), (0.32 * side, -0.468, 2.72)],
            hair,
            0.015,
            root,
        )
        sphere(f"Cheek {side}", (0.34 * side, -0.445, 2.40), (0.095, 0.014, 0.045), blush, root, 28, 16)
        curve(
            f"Earring link {side}",
            [(0.50 * side, -0.14, 2.42), (0.51 * side, -0.16, 2.34)],
            gold,
            0.012,
            root,
        )
        sphere(f"Pearl earring {side}", (0.51 * side, -0.16, 2.29), (0.050, 0.038, 0.065), pearl, root, 24, 16)
    sphere("Nose", (0, -0.475, 2.46), (0.035, 0.025, 0.045), skin, root, 24, 16)
    curve("Smile", [(-0.075, -0.486, 2.34), (0, -0.503, 2.31), (0.075, -0.486, 2.34)], mouth, 0.012, root)

    sphere("Torso", (0, 0.0, 1.74), (0.37, 0.24, 0.39), ivory, root)
    cone("Chima", (0, 0.04, 0.94), 0.68, 0.35, 1.30, rose, root)
    cylinder("High waist", (0, 0.02, 1.55), 0.36, 0.13, ribbon, root)
    sphere("Left jeogori panel", (-0.19, -0.22, 1.82), (0.23, 0.09, 0.30), ivory, root)
    sphere("Right jeogori panel", (0.19, -0.22, 1.82), (0.23, 0.09, 0.30), ivory, root)
    curve("Jeogori collar left", [(-0.24, -0.31, 2.02), (0.02, -0.35, 1.72)], rose_light, 0.022, root)
    curve("Jeogori collar right", [(0.24, -0.31, 2.02), (-0.02, -0.36, 1.72)], rose_light, 0.022, root)
    rounded_cube("Ot-goreum upper", (-0.13, -0.34, 1.69), (0.16, 0.035, 0.045), ribbon, root, 0.035)
    rounded_cube("Ot-goreum lower", (0.03, -0.34, 1.60), (0.055, 0.035, 0.19), ribbon, root, 0.035)
    cylinder("Chima hem", (0, 0.04, 0.30), 0.69, 0.032, rose_light, root)
    for x in (-0.45, -0.30, -0.15, 0.0, 0.15, 0.30, 0.45):
        curve(
            f"Chima embroidery {x}",
            [(x * 0.66, -0.60, 0.72), (x * 0.86, -0.66, 0.49), (x, -0.58, 0.31)],
            rose_light,
            0.011,
            root,
        )

    left_arm = empty("Left arm rig", (0.42, 0, 1.92), root)
    right_arm = empty("Right arm rig", (-0.42, 0, 1.92), root)
    for side, rig in ((1, left_arm), (-1, right_arm)):
        cylinder(f"Wide sleeve {side}", (0.05 * side, 0, -0.29), 0.135, 0.58, ivory, rig)
        cylinder(f"Forearm {side}", (0.06 * side, -0.01, -0.64), 0.082, 0.20, skin, rig)
        sphere(f"Hand {side}", (0.06 * side, -0.01, -0.78), (0.095, 0.075, 0.12), skin, rig, 32, 20)
        cylinder(f"Sleeve embroidery {side}", (0.05 * side, -0.01, -0.55), 0.137, 0.025, rose_light, rig)

    left_leg = empty("Left leg rig", (0.19, 0, 0.56), root)
    right_leg = empty("Right leg rig", (-0.19, 0, 0.56), root)
    for side, rig in ((1, left_leg), (-1, right_leg)):
        cylinder(f"Beoseon leg {side}", (0, 0, -0.23), 0.105, 0.46, sock, rig)
        shoe_obj = rounded_cube(f"Flower shoe {side}", (0, -0.08, -0.49), (0.15, 0.23, 0.09), shoe, rig, 0.08)
        shoe_obj.rotation_euler.x = math.radians(-4)
        sphere(f"Shoe pearl {side}", (0, -0.29, -0.48), (0.035, 0.025, 0.025), flower, rig, 18, 12)

    curve(
        "Norigae cord",
        [(0.27, -0.35, 1.56), (0.31, -0.40, 1.20), (0.29, -0.42, 0.93)],
        gold,
        0.015,
        root,
    )
    sphere("Norigae medallion", (0.29, -0.43, 1.10), (0.070, 0.025, 0.090), gold, root, 24, 16)
    for offset in (-0.035, 0.0, 0.035):
        curve(
            f"Norigae tassel {offset}",
            [(0.29 + offset, -0.43, 1.01), (0.29 + offset, -0.43, 0.79)],
            gold,
            0.010,
            root,
        )

    return root, left_leg, right_leg, left_arm, right_arm


def build_guest03_character():
    skin = material("Skin", (0.96, 0.72, 0.62))
    blush = material("Blush", (0.98, 0.45, 0.42), roughness=0.9)
    hair = material("Black hair", (0.018, 0.022, 0.030), roughness=0.34)
    hair_highlight = material("Blue black hair highlight", (0.065, 0.080, 0.115), roughness=0.38)
    navy = material("Navy suit", (0.025, 0.070, 0.160))
    navy_dark = material("Navy suit shadow", (0.012, 0.030, 0.080))
    shirt = material("White shirt", (0.95, 0.95, 0.93))
    tie = material("Midnight navy tie", (0.018, 0.035, 0.085), roughness=0.45)
    shoe = material("Black dress shoes", (0.015, 0.018, 0.024), roughness=0.30)
    metal = material("Suit button", (0.15, 0.16, 0.18), roughness=0.25, metallic=0.55)
    eye_white = material("Eye white", (0.98, 0.98, 0.97), roughness=0.25)
    iris = material("Warm brown iris", (0.18, 0.065, 0.020), roughness=0.28)
    pupil = material("Pupil", (0.008, 0.006, 0.004), roughness=0.2)
    mouth = material("Mouth", (0.48, 0.075, 0.065), roughness=0.6)

    root = empty("Guest03_Master")

    sphere("Head", (0, -0.01, 2.50), (0.53, 0.46, 0.52), skin, root)
    sphere("Left ear", (-0.50, -0.01, 2.47), (0.10, 0.07, 0.14), skin, root)
    sphere("Right ear", (0.50, -0.01, 2.47), (0.10, 0.07, 0.14), skin, root)

    sphere("Hair back", (0, 0.15, 2.62), (0.58, 0.46, 0.50), hair, root)
    sphere("Side part left", (-0.24, -0.22, 2.80), (0.39, 0.24, 0.22), hair_highlight, root)
    sphere("Side part right", (0.22, -0.20, 2.78), (0.34, 0.23, 0.24), hair, root)
    for index, x in enumerate((-0.46, -0.30, -0.14, 0.02, 0.18, 0.34, 0.47)):
        sphere(
            f"Short hair lock {index + 1}",
            (x, 0.34 + 0.02 * (index % 2), 2.48 + 0.08 * (1.0 - abs(x) / 0.5)),
            (0.15, 0.12, 0.24),
            hair_highlight if index % 3 == 0 else hair,
            root,
            segments=32,
            rings=20,
        )
    curve(
        "Front side part",
        [(-0.34, -0.42, 2.88), (-0.14, -0.49, 2.76), (0.08, -0.48, 2.67)],
        hair_highlight,
        0.055,
        root,
    )
    curve(
        "Front fringe",
        [(0.06, -0.46, 2.86), (0.22, -0.49, 2.75), (0.34, -0.44, 2.66)],
        hair,
        0.050,
        root,
    )

    for side in (-1, 1):
        sphere(f"Eye white {side}", (0.205 * side, -0.438, 2.57), (0.145, 0.035, 0.110), eye_white, root, 36, 24)
        sphere(f"Iris {side}", (0.205 * side, -0.470, 2.56), (0.076, 0.022, 0.080), iris, root, 32, 20)
        sphere(f"Pupil {side}", (0.205 * side, -0.487, 2.555), (0.037, 0.012, 0.045), pupil, root, 24, 16)
        sphere(f"Eye highlight {side}", (0.180 * side, -0.500, 2.59), (0.016, 0.008, 0.020), eye_white, root, 20, 12)
        curve(
            f"Eyebrow {side}",
            [(0.09 * side, -0.472, 2.72), (0.21 * side, -0.489, 2.75), (0.34 * side, -0.467, 2.71)],
            hair,
            0.020,
            root,
        )
        sphere(f"Cheek {side}", (0.34 * side, -0.445, 2.40), (0.080, 0.012, 0.036), blush, root, 24, 14)
    sphere("Nose", (0, -0.475, 2.46), (0.035, 0.025, 0.045), skin, root, 24, 16)
    curve("Smile", [(-0.075, -0.486, 2.34), (0, -0.503, 2.31), (0.075, -0.486, 2.34)], mouth, 0.012, root)

    sphere("Suit torso", (0, 0.0, 1.68), (0.38, 0.25, 0.44), navy, root)
    rounded_cube("Shirt front", (0, -0.245, 1.78), (0.13, 0.035, 0.34), shirt, root, 0.035)
    curve("Left lapel", [(-0.28, -0.30, 2.03), (-0.10, -0.35, 1.77), (-0.24, -0.31, 1.55)], navy_dark, 0.035, root)
    curve("Right lapel", [(0.28, -0.30, 2.03), (0.10, -0.35, 1.77), (0.24, -0.31, 1.55)], navy_dark, 0.035, root)
    cone("Tie knot", (0, -0.315, 1.99), 0.080, 0.045, 0.13, tie, root, vertices=32)
    rounded_cube("Tie body", (0, -0.315, 1.73), (0.060, 0.025, 0.23), tie, root, 0.025)
    rounded_cube("Pocket square", (0.25, -0.275, 1.79), (0.075, 0.025, 0.035), shirt, root, 0.018)
    sphere("Jacket button upper", (0, -0.267, 1.52), (0.040, 0.020, 0.040), metal, root, 20, 12)
    sphere("Jacket button lower", (0, -0.267, 1.40), (0.035, 0.018, 0.035), metal, root, 20, 12)
    for side in (-1, 1):
        rounded_cube(f"Jacket pocket {side}", (0.24 * side, -0.262, 1.38), (0.12, 0.024, 0.035), navy_dark, root, 0.018)

    left_arm = empty("Left arm rig", (0.43, 0, 1.88), root)
    right_arm = empty("Right arm rig", (-0.43, 0, 1.88), root)
    for side, rig in ((1, left_arm), (-1, right_arm)):
        cylinder(f"Suit sleeve {side}", (0.05 * side, 0, -0.31), 0.120, 0.60, navy, rig)
        cylinder(f"Shirt cuff {side}", (0.06 * side, -0.01, -0.61), 0.103, 0.075, shirt, rig)
        cylinder(f"Wrist {side}", (0.06 * side, -0.01, -0.69), 0.080, 0.12, skin, rig)
        sphere(f"Hand {side}", (0.06 * side, -0.01, -0.80), (0.095, 0.075, 0.12), skin, rig, 32, 20)

    left_leg = empty("Left leg rig", (0.19, 0, 0.92), root)
    right_leg = empty("Right leg rig", (-0.19, 0, 0.92), root)
    for side, rig in ((1, left_leg), (-1, right_leg)):
        cylinder(f"Suit trouser {side}", (0, 0, -0.43), 0.145, 0.86, navy, rig)
        rounded_cube(f"Dress shoe {side}", (0, -0.10, -0.88), (0.17, 0.25, 0.105), shoe, rig, 0.08)
        rounded_cube(f"Shoe welt {side}", (0, -0.13, -0.96), (0.18, 0.26, 0.030), navy_dark, rig, 0.025)

    return root, left_leg, right_leg, left_arm, right_arm


def build_guest04_character():
    root, left_leg, right_leg, left_arm, right_arm = build_guest03_character()
    root.name = "Guest04_Master"

    brown_hair = material("Warm brown hair", (0.105, 0.040, 0.020), roughness=0.34)
    brown_highlight = material("Warm brown hair highlight", (0.235, 0.090, 0.040), roughness=0.38)
    charcoal = material("Charcoal blazer", (0.050, 0.055, 0.060))
    charcoal_dark = material("Charcoal blazer shadow", (0.018, 0.020, 0.024))
    black_inner = material("Black crew neck shirt", (0.010, 0.012, 0.014), roughness=0.52)
    belt = material("Black leather belt", (0.012, 0.013, 0.015), roughness=0.30)
    buckle = material("Silver belt buckle", (0.34, 0.36, 0.39), roughness=0.24, metallic=0.70)

    for obj in root.children_recursive:
        name = obj.name
        if name.startswith(
            (
                "Hair back",
                "Side part",
                "Short hair lock",
                "Front side part",
                "Front fringe",
                "Eyebrow",
            )
        ):
            obj.data.materials.clear()
            highlighted = "highlight" in name.lower() or name.endswith(("1", "4", "7"))
            obj.data.materials.append(brown_highlight if highlighted else brown_hair)
        elif name.startswith(("Suit torso", "Suit sleeve", "Suit trouser")):
            obj.data.materials.clear()
            obj.data.materials.append(charcoal)
        elif name.startswith(("Left lapel", "Right lapel", "Jacket pocket")):
            obj.data.materials.clear()
            obj.data.materials.append(charcoal_dark)
        elif name == "Shirt front":
            obj.data.materials.clear()
            obj.data.materials.append(black_inner)
            obj.scale.x *= 1.35
        elif name.startswith(("Tie knot", "Tie body", "Pocket square")):
            obj.hide_render = True
            obj.hide_viewport = True
        elif name.startswith("Shirt cuff"):
            obj.data.materials.clear()
            obj.data.materials.append(charcoal)

    for index, (x, z, tilt) in enumerate(
        (
            (-0.43, 2.67, -12),
            (-0.29, 2.83, -8),
            (-0.12, 2.91, -4),
            (0.09, 2.90, 5),
            (0.27, 2.82, 9),
            (0.43, 2.65, 13),
        )
    ):
        lock = sphere(
            f"Guest04 wavy crown lock {index + 1}",
            (x, -0.20, z),
            (0.18, 0.15, 0.27),
            brown_highlight if index in (1, 4) else brown_hair,
            root,
            segments=32,
            rings=20,
        )
        lock.rotation_euler.y = math.radians(tilt)
    curve(
        "Guest04 left curtain fringe",
        [(-0.34, -0.46, 2.92), (-0.23, -0.52, 2.76), (-0.10, -0.49, 2.64)],
        brown_highlight,
        0.055,
        root,
    )
    curve(
        "Guest04 right curtain fringe",
        [(0.35, -0.45, 2.91), (0.23, -0.51, 2.76), (0.10, -0.49, 2.64)],
        brown_hair,
        0.055,
        root,
    )

    rounded_cube("Leather belt", (0, -0.272, 1.22), (0.35, 0.030, 0.045), belt, root, 0.020)
    rounded_cube("Belt buckle", (0, -0.309, 1.22), (0.070, 0.020, 0.060), buckle, root, 0.018)

    return root, left_leg, right_leg, left_arm, right_arm


def build_guest05_character():
    root, left_leg, right_leg, left_arm, right_arm = build_guest02_character()
    root.name = "Guest05_Master"

    brown_hair = material("Guest05 deep brown hair", (0.105, 0.042, 0.024), roughness=0.36)
    brown_highlight = material("Guest05 hair highlight", (0.245, 0.100, 0.058), roughness=0.40)
    ivory = material("Guest05 ivory bolero", (0.94, 0.90, 0.84))
    sage = material("Guest05 sage dress", (0.40, 0.49, 0.39))
    sage_light = material("Guest05 sage fold", (0.57, 0.65, 0.54))
    sage_dark = material("Guest05 sage ribbon", (0.29, 0.37, 0.29))
    skin = material("Guest05 leg skin", (0.96, 0.72, 0.62))
    shoe = material("Guest05 ivory heels", (0.88, 0.82, 0.73), roughness=0.48)
    bag = material("Guest05 beige handbag", (0.66, 0.52, 0.42), roughness=0.56)
    gold = material("Guest05 warm gold", (0.78, 0.48, 0.08), roughness=0.32, metallic=0.72)

    for obj in root.children_recursive:
        name = obj.name
        if name.startswith(("Hair ", "Low bun", "Bun braid", "Face curl", "Back crown braid", "Eyebrow")):
            obj.data.materials.clear()
            highlighted = name.startswith(("Hair left", "Bun braid", "Face curl", "Back crown braid"))
            obj.data.materials.append(brown_highlight if highlighted else brown_hair)
        elif name.startswith(("Hairpin",)):
            obj.hide_render = True
            obj.hide_viewport = True
        elif name in {"Torso", "Left jeogori panel", "Right jeogori panel"} or name.startswith("Wide sleeve"):
            obj.data.materials.clear()
            obj.data.materials.append(ivory)
        elif name == "Chima":
            obj.data.materials.clear()
            obj.data.materials.append(sage)
            obj.scale.z = 0.82
            obj.location.z = 1.05
        elif name == "High waist":
            obj.data.materials.clear()
            obj.data.materials.append(sage_dark)
        elif name in {"Jeogori collar left", "Jeogori collar right"}:
            obj.data.materials.clear()
            obj.data.materials.append(sage_light)
        elif name.startswith(("Ot-goreum", "Chima embroidery")):
            obj.hide_render = True
            obj.hide_viewport = True
        elif name == "Chima hem":
            obj.data.materials.clear()
            obj.data.materials.append(sage_light)
            obj.location.z = 0.52
        elif name.startswith("Beoseon leg"):
            obj.data.materials.clear()
            obj.data.materials.append(skin)
        elif name.startswith(("Flower shoe", "Shoe pearl")):
            obj.data.materials.clear()
            obj.data.materials.append(shoe)
        elif name.startswith("Norigae"):
            obj.hide_render = True
            obj.hide_viewport = True

    curve(
        "Guest05 wrap neckline left",
        [(-0.25, -0.34, 2.01), (0.02, -0.38, 1.72)],
        sage,
        0.026,
        root,
    )
    curve(
        "Guest05 wrap neckline right",
        [(0.25, -0.34, 2.01), (-0.02, -0.39, 1.72)],
        sage,
        0.026,
        root,
    )
    sphere("Guest05 waist bow center", (0.17, -0.39, 1.55), (0.070, 0.035, 0.070), sage_dark, root)
    for side in (-1, 1):
        bow = sphere(
            f"Guest05 waist bow loop {side}",
            (0.17 + 0.10 * side, -0.38, 1.56),
            (0.13, 0.035, 0.085),
            sage_dark,
            root,
            28,
            18,
        )
        bow.rotation_euler.y = math.radians(22 * side)
    curve(
        "Guest05 waist bow tail",
        [(0.18, -0.38, 1.50), (0.25, -0.39, 1.18), (0.20, -0.36, 0.93)],
        sage_dark,
        0.036,
        root,
    )

    rounded_cube(
        "Guest05 right-hand handbag",
        (-0.24, -0.03, -0.95),
        (0.22, 0.09, 0.20),
        bag,
        right_arm,
        0.065,
    )
    curve(
        "Guest05 handbag handle",
        [(-0.36, -0.04, -0.78), (-0.29, -0.05, -0.59), (-0.13, -0.05, -0.78)],
        gold,
        0.018,
        right_arm,
    )
    rounded_cube(
        "Guest05 handbag clasp",
        (-0.24, -0.13, -0.94),
        (0.045, 0.018, 0.050),
        gold,
        right_arm,
        0.018,
    )

    return root, left_leg, right_leg, left_arm, right_arm


def set_walk_animation(root, left_leg, right_leg, left_arm, right_arm, guest_id):
    left_base_z = left_leg.location.z
    right_base_z = right_leg.location.z
    poses = (
        (1, 0.24, -0.24, math.radians(-11), math.radians(8), 0.0),
        (7, 0.0, 0.0, 0.0, 0.0, 0.035),
        (13, -0.24, 0.24, math.radians(8), math.radians(-11), 0.0),
        (19, 0.0, 0.0, 0.0, 0.0, 0.035),
        (25, 0.24, -0.24, math.radians(-11), math.radians(8), 0.0),
    )
    for frame, left_stride, right_stride, left_arm_rotation, right_arm_rotation, bob in poses:
        left_leg.location.y = left_stride
        right_leg.location.y = right_stride
        left_leg.location.z = left_base_z + (0.025 if left_stride < 0 else 0.0)
        right_leg.location.z = right_base_z + (0.025 if right_stride < 0 else 0.0)
        left_arm.rotation_euler.x = left_arm_rotation
        right_arm.rotation_euler.x = right_arm_rotation
        root.location.z = bob
        for obj in (left_leg, right_leg):
            obj.keyframe_insert(data_path="location", frame=frame)
        for obj in (left_arm, right_arm):
            obj.keyframe_insert(data_path="rotation_euler", frame=frame)
        root.keyframe_insert(data_path="location", frame=frame)
    if root.animation_data and root.animation_data.action:
        root.animation_data.action.name = f"{guest_id.replace('-', '').title()}_Walk"


def point_camera(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def configure_scene(output_root):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 384
    scene.render.resolution_y = 576
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(output_root)
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.frame_start = 1
    scene.frame_end = 25
    scene.render.fps = 24

    world = bpy.data.worlds.new("Studio world") if not scene.world else scene.world
    scene.world = world
    world.color = (0.045, 0.045, 0.045)

    bpy.ops.object.camera_add(location=(0, -8.5, 1.55))
    camera = bpy.context.object
    camera.name = "Orthographic sprite camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 3.45
    point_camera(camera, (0, 0, 1.52))
    scene.camera = camera

    for name, location, energy, size, color in (
        ("Key", (-4.5, -4.5, 6.0), 1150, 4.0, (1.0, 0.86, 0.76)),
        ("Fill", (4.0, -2.5, 3.5), 900, 3.0, (0.75, 0.86, 1.0)),
        ("Rim", (0.0, 4.0, 5.0), 1050, 3.0, (1.0, 0.78, 0.66)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        light = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(light)
        light.location = location
        point_camera(light, (0, 0, 1.5))


def render_frames(root, output_root):
    scene = bpy.context.scene
    directions = {
        "down": 0,
        "left": -90,
        "right": 90,
        "up": 180,
    }
    step_frames = (1, 7, 13)
    render_root = output_root / "renders"
    for direction, degrees in directions.items():
        root.rotation_euler.z = math.radians(degrees)
        for step, frame in enumerate(step_frames, start=1):
            scene.frame_set(frame)
            path = render_root / direction / f"step-{step:02d}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    output_root = Path(args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    clear_scene()
    configure_scene(output_root)
    builders = {
        "guest-01": build_guest01_character,
        "guest-02": build_guest02_character,
        "guest-03": build_guest03_character,
        "guest-04": build_guest04_character,
        "guest-05": build_guest05_character,
    }
    root, left_leg, right_leg, left_arm, right_arm = builders[args.guest]()
    set_walk_animation(root, left_leg, right_leg, left_arm, right_arm, args.guest)
    render_frames(root, output_root)

    root.rotation_euler.z = 0
    bpy.context.scene.frame_set(7)
    blend_path = output_root / f"{args.guest}-master.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.type not in {"CAMERA", "LIGHT"})
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(output_root / f"{args.guest}-master.glb"),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
    )
    print(f"3D master written to {output_root}")


if __name__ == "__main__":
    main()
